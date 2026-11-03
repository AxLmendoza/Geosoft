import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { db } from '../config/db'
import { Report } from '../models/Report'
import { Category } from '../models/Category'
import { User } from '../models/User'
import { ReportFlag } from '../models/ReportFlag'
import { ReportHistory } from '../models/ReportHistory'
import { ReportVote } from '../models/ReportVote'
import { storage } from '../utils/storage'
import { isStaff, serializeReport } from '../utils/serializers'
import { getVoteSummaries } from '../utils/votes'
import { changeStatus, publicVisibilityWhere } from '../utils/reportStatus'

const userAttrs = ['id', 'name', 'email', 'banned']

export const reportIncludes = [
  { model: Category, attributes: ['id', 'name', 'slug', 'color'] },
  { model: User, attributes: userAttrs },
]

/** Filtros comunes: ?category=1&status=pendiente&severity=alta&from=2026-01-01&to=2026-12-31&bbox=minLng,minLat,maxLng,maxLat */
export function buildReportFilters(query: Request['query']): Record<string, any> {
  const where: Record<string, any> = {}
  if (query.category) where.categoryId = Number(query.category)
  if (query.status) where.status = query.status
  if (query.severity) where.severity = query.severity
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { [Op.gte]: new Date(String(query.from)) } : {}),
      ...(query.to ? { [Op.lte]: new Date(`${query.to}T23:59:59`) } : {}),
    }
  }
  if (query.bbox) {
    const [minLng, minLat, maxLng, maxLat] = String(query.bbox).split(',').map(Number)
    if ([minLng, minLat, maxLng, maxLat].every(Number.isFinite)) {
      where.lat = { [Op.between]: [minLat, maxLat] }
      where.lng = { [Op.between]: [minLng, maxLng] }
    }
  }
  return where
}

/** Serializa una lista agregando los votos de la comunidad */
export async function serializeMany(reports: Report[], viewer?: User | null) {
  const votes = await getVoteSummaries(reports.map((r) => r.id), viewer)
  return reports.map((r) => serializeReport(r, viewer, votes.get(r.id)))
}

export class ReportController {
  /** Mapa público: no ocultos, no borrados y los resueltos solo durante N días */
  static async getAll(req: Request, res: Response) {
    const reports = await Report.findAll({
      where: { ...buildReportFilters(req.query), ...publicVisibilityWhere() },
      include: reportIncludes,
      order: [['createdAt', 'DESC']],
      limit: Math.min(Number(req.query.limit ?? 500), 1000),
    })
    res.json(await serializeMany(reports, req.user))
  }

  static async getMine(req: Request, res: Response) {
    const reports = await Report.findAll({
      where: { userId: req.user!.id },
      include: reportIncludes,
      order: [['createdAt', 'DESC']],
    })
    res.json(await serializeMany(reports, req.user))
  }

  static async getById(req: Request, res: Response) {
    const report = await Report.findByPk(req.params.reportId, {
      paranoid: req.user?.role !== 'admin', // el admin puede ver reportes borrados
      include: [
        ...reportIncludes,
        { model: ReportHistory, include: [{ model: User, attributes: ['id', 'name', 'role'] }] },
      ],
      order: [[{ model: ReportHistory, as: 'history' }, 'createdAt', 'ASC']],
    })
    const canSee = report && (!report.hidden || isStaff(req.user) || report.userId === req.user?.id)
    if (!report || !canSee) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    const votes = await getVoteSummaries([report.id], req.user)
    const json = serializeReport(report, req.user, votes.get(report.id))
    // En el historial público no se expone qué moderador hizo el cambio
    if (!isStaff(req.user)) {
      json.history = json.history?.map((h: any) => ({
        ...h,
        changedBy: h.changedBy ? { role: h.changedBy.role } : null,
        changedById: undefined,
      }))
    }
    res.json(json)
  }

  static async create(req: Request, res: Response) {
    if (!req.file) {
      res.status(400).json({ error: 'La imagen del siniestro es obligatoria' })
      return
    }
    const category = await Category.findByPk(req.body.categoryId)
    if (!category) {
      res.status(400).json({ error: 'Categoría no válida' })
      return
    }

    const { imageUrl, thumbUrl } = await storage.saveReportImage(req.file.buffer)
    try {
      const report = await db.transaction(async (t) => {
        const created = await Report.create(
          {
            title: req.body.title,
            description: req.body.description,
            categoryId: category.id,
            severity: req.body.severity ?? 'media',
            lat: req.body.lat,
            lng: req.body.lng,
            colonia: req.body.colonia || null,
            calle: req.body.calle || null,
            anonymous: req.body.anonymous !== false,
            imageUrl,
            thumbUrl,
            userId: req.user!.id,
          },
          { transaction: t },
        )
        await ReportHistory.create(
          { reportId: created.id, fromStatus: null, toStatus: 'pendiente', note: 'Reporte creado', changedById: req.user!.id },
          { transaction: t },
        )
        return created
      })
      await report.reload({ include: reportIncludes })
      res.status(201).json(serializeReport(report, req.user))
    } catch (error) {
      await storage.remove([imageUrl, thumbUrl]) // no dejar archivos huérfanos
      throw error
    }
  }

  /** El autor marca "le dieron seguimiento" (en_proceso) o "ya quedó" (resuelto) */
  static async ownerStatus(req: Request, res: Response) {
    const report = await Report.findByPk(req.params.reportId)
    if (!report) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    if (report.userId !== req.user!.id) {
      res.status(403).json({ error: 'Solo el autor puede actualizar su reporte' })
      return
    }
    if (report.status === 'resuelto' || report.status === 'rechazado') {
      res.status(400).json({ error: 'El reporte ya está cerrado' })
      return
    }
    if (report.status === req.body.status) {
      res.status(400).json({ error: 'El reporte ya tiene ese estado' })
      return
    }
    const defaultNote = req.body.status === 'resuelto' ? 'El ciudadano confirmó que ya quedó solucionado' : 'El ciudadano indica que ya le dieron seguimiento'
    await changeStatus(report, req.body.status, req.user!.id, req.body.note || defaultNote)
    res.json({ message: req.body.status === 'resuelto' ? '¡Marcado como solucionado!' : 'Marcado con seguimiento' })
  }

  /** "Clap" de la comunidad. Votar lo mismo otra vez quita el voto */
  static async vote(req: Request, res: Response) {
    const report = await Report.findByPk(req.params.reportId)
    if (!report || report.hidden) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    if (report.userId === req.user!.id) {
      res.status(400).json({ error: 'Usa las opciones de autor para actualizar tu reporte' })
      return
    }
    if (report.status === 'resuelto' || report.status === 'rechazado') {
      res.status(400).json({ error: 'El reporte ya está cerrado' })
      return
    }
    const existing = await ReportVote.findOne({ where: { reportId: report.id, userId: req.user!.id } })
    if (existing && existing.value === req.body.value) {
      await existing.destroy()
    } else if (existing) {
      await existing.update({ value: req.body.value })
    } else {
      await ReportVote.create({ reportId: report.id, userId: req.user!.id, value: req.body.value })
    }
    const votes = await getVoteSummaries([report.id], req.user)
    res.json(votes.get(report.id))
  }

  /** Borrado lógico por el autor (la foto se conserva para el historial del admin) */
  static async remove(req: Request, res: Response) {
    const report = await Report.findByPk(req.params.reportId)
    if (!report) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    if (report.userId !== req.user!.id && !isStaff(req.user)) {
      res.status(403).json({ error: 'No puedes eliminar este reporte' })
      return
    }
    await report.update({ deletedById: req.user!.id })
    await report.destroy()
    res.json({ message: 'Reporte eliminado' })
  }

  /** Cualquier usuario puede denunciar un reporte (una vez) */
  static async flag(req: Request, res: Response) {
    const report = await Report.findByPk(req.params.reportId)
    if (!report || report.hidden) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    if (report.userId === req.user!.id) {
      res.status(400).json({ error: 'No puedes denunciar tu propio reporte' })
      return
    }
    const exists = await ReportFlag.findOne({ where: { reportId: report.id, userId: req.user!.id } })
    if (exists) {
      res.status(409).json({ error: 'Ya denunciaste este reporte' })
      return
    }
    await ReportFlag.create({
      reportId: report.id,
      userId: req.user!.id,
      reason: req.body.reason,
      comment: req.body.comment || null,
    })

    // Ocultar automáticamente si junta muchas denuncias pendientes
    const pending = await ReportFlag.count({ where: { reportId: report.id, status: 'pendiente' } })
    if (pending >= Number(process.env.FLAG_AUTOHIDE ?? 5)) {
      await report.update({ hidden: true, hiddenReason: `Oculto automáticamente: ${pending} denuncias pendientes` })
    }
    res.status(201).json({ message: 'Gracias, un moderador revisará el reporte' })
  }
}
