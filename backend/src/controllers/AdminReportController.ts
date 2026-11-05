import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { db } from '../config/db'
import { Report } from '../models/Report'
import { Category } from '../models/Category'
import { ReportFlag } from '../models/ReportFlag'
import { ReportHistory } from '../models/ReportHistory'
import { storage } from '../utils/storage'
import { serializeReport } from '../utils/serializers'
import { autoAssign, changeStatus } from '../utils/reportStatus'
import { buildReportFilters, reportIncludes, serializeMany } from './ReportController'

/** Campos editables que llegan en el formulario (multipart) */
const EDITABLE = ['title', 'description', 'categoryId', 'severity', 'lat', 'lng', 'colonia', 'calle', 'anonymous', 'hidden', 'hiddenReason'] as const

function pickFields(body: Record<string, any>) {
  const data: Record<string, any> = {}
  for (const key of EDITABLE) {
    if (body[key] === undefined) continue
    data[key] = ['colonia', 'calle', 'hiddenReason'].includes(key) ? body[key] || null : body[key]
  }
  return data
}

/** CRUD completo de reportes, solo para el administrador */
export class AdminReportController {
  /**
   * ?q=texto&status=&category=&severity=&area=&deleted=true (solo eliminados) | all (todos)
   * &page=1&limit=50 → el total va en la cabecera X-Total-Count (el cuerpo sigue siendo un arreglo)
   */
  static async list(req: Request, res: Response) {
    const where: Record<string, any> = { ...buildReportFilters(req.query) }
    if (req.query.q) {
      const q = `%${req.query.q}%`
      where[Op.or as any] = [{ title: { [Op.iLike]: q } }, { description: { [Op.iLike]: q } }, { colonia: { [Op.iLike]: q } }, { calle: { [Op.iLike]: q } }]
    }
    if (req.query.deleted === 'true') where.deletedAt = { [Op.ne]: null }

    const limit = Math.min(Number(req.query.limit ?? 500), 500)
    const page = Math.max(Number(req.query.page ?? 1), 1)
    const { rows, count } = await Report.findAndCountAll({
      where,
      paranoid: !req.query.deleted,
      include: [...reportIncludes, { model: ReportFlag, attributes: ['id', 'status', 'reason'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    })
    res.setHeader('X-Total-Count', String(count))
    res.json(await serializeMany(rows, req.user))
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
      const status = req.body.status ?? 'pendiente'
      const report = await db.transaction(async (t) => {
        const created = await Report.create(
          {
            severity: 'media',
            anonymous: false,
            ...pickFields(req.body),
            status,
            resolvedAt: status === 'resuelto' ? new Date() : null,
            imageUrl,
            thumbUrl,
            mediumUrl,
            userId: req.user!.id,
          },
          { transaction: t },
        )
        await ReportHistory.create(
          { reportId: created.id, kind: 'estado', fromStatus: null, toStatus: status, note: 'Reporte creado por el administrador', changedById: req.user!.id },
          { transaction: t },
        )
        // Igual que los reportes ciudadanos: se asigna al área de la categoría si sigue sin atender
        if (status === 'pendiente') await autoAssign(created, category, t)
        return created
      })
      await report.reload({ include: reportIncludes })
      res.status(201).json(serializeReport(report, req.user))
    } catch (error) {
      await storage.remove([imageUrl, thumbUrl, mediumUrl])
      throw error
    }
  }

  /** Edita cualquier campo; la imagen es opcional y reemplaza la anterior */
  static async update(req: Request, res: Response) {
    const report = await Report.findByPk(req.params.reportId, { paranoid: false })
    if (!report) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    if (req.body.categoryId && !(await Category.findByPk(req.body.categoryId))) {
      res.status(400).json({ error: 'Categoría no válida' })
      return
    }

    const oldFiles = [report.imageUrl, report.thumbUrl, report.mediumUrl]
    const image = req.file ? await storage.saveReportImage(req.file.buffer) : null
    try {
      await db.transaction(async (t) => {
        await report.update({ ...pickFields(req.body), ...(image ?? {}) }, { transaction: t })
        if (req.body.status && req.body.status !== report.status) {
          await changeStatus(report, req.body.status, req.user!.id, req.body.note || 'Editado por el administrador', t)
        }
      })
    } catch (error) {
      if (image) await storage.remove([image.imageUrl, image.thumbUrl, image.mediumUrl])
      throw error
    }
    if (image) await storage.remove(oldFiles)

    await report.reload({ include: reportIncludes, paranoid: false })
    res.json(serializeReport(report, req.user))
  }

  /** Borrado definitivo: elimina el registro, su historial, votos, denuncias, las fotos y las evidencias */
  static async destroy(req: Request, res: Response) {
    const report = await Report.findByPk(req.params.reportId, { paranoid: false })
    if (!report) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    const evidence = await ReportHistory.findAll({ where: { reportId: report.id }, attributes: ['imageUrl', 'thumbUrl'] })
    const files = [report.imageUrl, report.thumbUrl, report.mediumUrl, ...evidence.flatMap((h) => [h.imageUrl, h.thumbUrl])]
    await db.transaction((t) => report.destroy({ force: true, transaction: t }))
    await storage.remove(files)
    res.json({ message: 'Reporte eliminado definitivamente' })
  }
}
