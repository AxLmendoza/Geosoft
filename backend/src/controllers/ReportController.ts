import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { db } from '../config/db'
import { Report } from '../models/Report'
import { Category } from '../models/Category'
import { User } from '../models/User'
import { ReportFlag } from '../models/ReportFlag'
import { ReportHistory } from '../models/ReportHistory'
import { ReportVote } from '../models/ReportVote'
import { Area } from '../models/Area'
import { CLOSED_STATUSES, CONFIRMABLE_STATUSES, type VoteValue } from '../models/constants'
import { storage } from '../utils/storage'
import { isStaff, serializeReport, type AssigneeMap } from '../utils/serializers'
import { getVoteSummaries } from '../utils/votes'
import { addUpdate, autoAssign, changeStatus, publicVisibilityWhere } from '../utils/reportStatus'
import { emitReportEvent } from '../services/events'

const userAttrs = ['id', 'name', 'email', 'banned']

export const reportIncludes = [
  { model: Category, attributes: ['id', 'name', 'slug', 'color'] },
  { model: User, attributes: userAttrs },
  { model: Area, attributes: ['id', 'name', 'type'] },
]

/** Historial con responsable (y su área) y áreas de origen/destino de cada asignación */
export const historyInclude = {
  model: ReportHistory,
  include: [
    { model: User, as: 'changedBy', attributes: ['id', 'name', 'role', 'areaId'], include: [{ model: Area, attributes: ['id', 'name'] }] },
    { model: Area, as: 'fromArea', attributes: ['id', 'name'] },
    { model: Area, as: 'toArea', attributes: ['id', 'name'] },
  ],
}

/**
 * Filtros comunes: ?category=1&status=pendiente&severity=alta&area=3|none
 * &from=2026-01-01&to=2026-12-31&bbox=minLng,minLat,maxLng,maxLat
 */
export function buildReportFilters(query: Request['query']): Record<string, any> {
  const where: Record<string, any> = {}
  if (query.category) where.categoryId = Number(query.category)
  if (query.status) where.status = query.status
  if (query.severity) where.severity = query.severity
  if (query.area === 'none') where.areaId = null
  else if (query.area) where.areaId = Number(query.area)
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

/** Nombres de los responsables directos (solo se consultan si quien ve es personal) */
export async function loadAssignees(reports: Report[], viewer?: User | null): Promise<AssigneeMap> {
  const staff = !!viewer && viewer.role !== 'ciudadano'
  const ids = staff ? [...new Set(reports.map((r) => r.assigneeId).filter((id): id is number => !!id))] : []
  if (!ids.length) return new Map()
  const users = await User.findAll({ where: { id: ids }, attributes: ['id', 'name', 'active'] })
  return new Map(users.map((u) => [u.id, { id: u.id, name: u.name, active: u.active }]))
}

/** Serializa una lista agregando los votos de la comunidad y el responsable directo */
export async function serializeMany(reports: Report[], viewer?: User | null) {
  const [votes, assignees] = await Promise.all([getVoteSummaries(reports.map((r) => r.id), viewer), loadAssignees(reports, viewer)])
  return reports.map((r) => serializeReport(r, viewer, votes.get(r.id), assignees))
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

  /** Solo los reportes del ciudadano autenticado */
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
      include: [...reportIncludes, historyInclude],
      order: [
        [{ model: ReportHistory, as: 'history' }, 'createdAt', 'ASC'],
        [{ model: ReportHistory, as: 'history' }, 'id', 'ASC'],
      ],
    })
    const ownArea = report?.areaId != null && report.areaId === req.user?.areaId && req.user?.role === 'operativo'
    const canSee = report && (!report.hidden || isStaff(req.user) || report.userId === req.user?.id || ownArea)
    if (!report || !canSee) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    const [votes, assignees] = await Promise.all([getVoteSummaries([report.id], req.user), loadAssignees([report], req.user)])
    // El serializador filtra el historial según quién consulta (público, autor o personal)
    res.json(serializeReport(report, req.user, votes.get(report.id), assignees))
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

    const { imageUrl, thumbUrl, mediumUrl } = await storage.saveReportImage(req.file.buffer)
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
            mediumUrl,
            userId: req.user!.id,
          },
          { transaction: t },
        )
        await ReportHistory.create(
          { reportId: created.id, kind: 'estado', fromStatus: null, toStatus: 'pendiente', note: 'Reporte recibido', changedById: req.user!.id },
          { transaction: t },
        )
        emitReportEvent('report.created', created.id, {}, t)
        // Distribución automática al área responsable de la categoría
        await autoAssign(created, category, t)
        return created
      })
      await report.reload({ include: reportIncludes })
      res.status(201).json(serializeReport(report, req.user))
    } catch (error) {
      await storage.remove([imageUrl, thumbUrl, mediumUrl]) // no dejar archivos huérfanos
      throw error
    }
  }

  /**
   * El autor indica "ya me dieron seguimiento" (en_proceso).
   * "Ya quedó" (resuelto) ya NO cambia el estado oficial: se registra como confirmación
   * ciudadana y el personal responsable decide el cierre (ver confirm).
   */
  static async ownerStatus(req: Request, res: Response) {
    if (req.body.status === 'resuelto') {
      req.body.value = 'solucionado'
      return ReportController.confirm(req, res)
    }
    const report = await Report.findByPk(req.params.reportId)
    if (!report) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    if (report.userId !== req.user!.id) {
      res.status(403).json({ error: 'Solo el autor puede actualizar su reporte' })
      return
    }
    if (CLOSED_STATUSES.includes(report.status)) {
      res.status(400).json({ error: 'El reporte ya está cerrado' })
      return
    }
    if (report.status === req.body.status) {
      res.status(400).json({ error: 'El reporte ya tiene ese estado' })
      return
    }
    await changeStatus(report, req.body.status, req.user!.id, req.body.note || 'El ciudadano indica que ya le dieron seguimiento')
    res.json({ message: 'Marcado con seguimiento' })
  }

  /** El ciudadano agrega información adicional (texto y/o una foto) a su propio reporte */
  static async addInfo(req: Request, res: Response) {
    const report = await Report.findByPk(req.params.reportId)
    // 404 también si no es suyo: no revelar reportes ajenos
    if (!report || report.userId !== req.user!.id) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    if (CLOSED_STATUSES.includes(report.status)) {
      res.status(400).json({ error: 'El reporte ya está cerrado, no se puede agregar información' })
      return
    }
    const note = (req.body.note as string | undefined)?.trim() || null
    if (!note && !req.file) {
      res.status(400).json({ error: 'Escribe la información adicional o adjunta una foto' })
      return
    }
    const evidence = req.file ? await storage.saveReportImage(req.file.buffer) : null
    try {
      await addUpdate(report, 'ciudadano', req.user!.id, note, { evidence })
    } catch (error) {
      if (evidence) await storage.remove([evidence.imageUrl, evidence.thumbUrl, evidence.mediumUrl])
      throw error
    }
    res.status(201).json({ message: 'Información agregada a tu reporte' })
  }

  /**
   * Confirmación ciudadana: "Confirmar que se resolvió" (solucionado) o "El problema continúa" (sin_solucion).
   * - Solo registra la respuesta (una por persona, se puede cambiar). NUNCA cambia el estado oficial.
   * - Se puede responder mientras el reporte está abierto o ya marcado como resuelto.
   * - La respuesta del autor queda además en su historial de seguimiento.
   * - "Continúa" sobre un reporte resuelto genera la señal de revisión (needsReview) para
   *   la administración y el área responsable.
   */
  static async confirm(req: Request, res: Response) {
    const report = await Report.findByPk(req.params.reportId)
    const isOwner = !!report && report.userId === req.user!.id
    if (!report || (report.hidden && !isOwner)) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    if (req.user!.role === 'admin' || req.user!.role === 'operativo') {
      res.status(403).json({ error: 'El personal registra la atención desde la bandeja de atención' })
      return
    }
    if (!CONFIRMABLE_STATUSES.includes(report.status)) {
      res.status(400).json({ error: 'El seguimiento de este reporte ya terminó' })
      return
    }
    const value = req.body.value as VoteValue
    const note = (req.body.note as string | undefined)?.trim() || null
    const existing = await ReportVote.findOne({ where: { reportId: report.id, userId: req.user!.id } })
    const changed = !existing || existing.value !== value

    await db.transaction(async (t) => {
      if (existing) {
        // changed('updatedAt') renueva la fecha aunque repita la misma respuesta (cuenta para la resolución vigente)
        existing.value = value
        existing.changed('updatedAt', true)
        await existing.save({ transaction: t })
      } else {
        await ReportVote.create({ reportId: report.id, userId: req.user!.id, value }, { transaction: t })
      }
      if (isOwner && (changed || note)) {
        const resolved = report.status === 'resuelto'
        const text =
          value === 'solucionado'
            ? resolved ? 'El ciudadano confirmó que el problema se resolvió' : 'El ciudadano indica que el problema ya se resolvió. El área responsable debe verificarlo.'
            : resolved ? 'El ciudadano indica que el problema continúa' : 'El ciudadano indica que el problema sigue sin resolverse'
        await ReportHistory.create(
          {
            reportId: report.id,
            kind: 'ciudadano',
            fromStatus: report.status,
            toStatus: report.status,
            note: note ? `${text}: ${note}` : text,
            internal: false,
            changedById: req.user!.id,
          },
          { transaction: t },
        )
      }
    })
    if (changed || note) emitReportEvent('report.citizen_feedback', report.id, { value, owner: isOwner, status: report.status, note: isOwner ? note : null })

    const votes = await getVoteSummaries([report.id], req.user)
    res.json({
      message: value === 'solucionado' ? 'Gracias, registramos que el problema se resolvió' : 'Gracias, avisamos al área responsable que el problema continúa',
      votes: votes.get(report.id),
    })
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
