import type { Request, Response } from 'express'
import { Op, fn, col, literal } from 'sequelize'
import { Report } from '../models/Report'
import { Area } from '../models/Area'
import { CLOSED_STATUSES, OPEN_STATUSES, OPERATIVO_STATUSES, type ReportStatus } from '../models/constants'
import { storage } from '../utils/storage'
import { canManageReport, isAdmin, isOperativo } from '../utils/permissions'
import { addUpdate, assignArea, changeStatus } from '../utils/reportStatus'
import { buildReportFilters, reportIncludes, serializeMany } from './ReportController'

/**
 * Bandeja de atención: personal operativo (solo su área), moderación y administración.
 * Toda la autorización se valida aquí, no solo ocultando botones en el frontend.
 */

/** Alcance según el rol: el operativo solo ve su área (aunque mande otro ?area=) */
function scopeWhere(req: Request): Record<string, any> | null {
  const where = buildReportFilters(req.query)
  if (req.user!.role === 'operativo') {
    if (!isOperativo(req.user)) return null // operativo sin área asignada: no ve nada
    where.areaId = req.user!.areaId
  }
  return where
}

async function loadManageable(req: Request, res: Response) {
  const report = await Report.findByPk(req.params.reportId)
  if (!report || !canManageReport(req.user, report)) {
    // 404 en lugar de 403 para no revelar reportes de otras áreas
    res.status(404).json({ error: 'Reporte no encontrado' })
    return null
  }
  return report
}

export class AttentionController {
  /** ?status=&area=&category=&severity=&q=&open=true&page=1&limit=20 → { data, total, page, pages } */
  static async list(req: Request, res: Response) {
    const where = scopeWhere(req)
    const limit = Math.min(Number(req.query.limit ?? 20), 100)
    const page = Math.max(Number(req.query.page ?? 1), 1)
    if (!where) {
      res.json({ data: [], total: 0, page, pages: 0 })
      return
    }
    if (req.query.open === 'true' && !req.query.status) where.status = OPEN_STATUSES
    if (req.query.q) {
      const q = `%${req.query.q}%`
      const asNumber = Number(String(req.query.q).replace('#', ''))
      where[Op.or as any] = [
        { title: { [Op.iLike]: q } },
        { colonia: { [Op.iLike]: q } },
        { calle: { [Op.iLike]: q } },
        ...(Number.isInteger(asNumber) && asNumber > 0 ? [{ id: asNumber }] : []),
      ]
    }

    const { rows, count } = await Report.findAndCountAll({
      where,
      include: reportIncludes,
      // Prioridad: abiertos críticos primero, luego los más antiguos sin atender
      order: [
        [literal(`CASE WHEN "Report"."status" IN ('resuelto','cerrado','rechazado','canalizado') THEN 1 ELSE 0 END`), 'ASC'],
        [literal(`CASE "Report"."severity" WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END`), 'ASC'],
        ['createdAt', 'ASC'],
      ],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    })
    res.json({ data: await serializeMany(rows, req.user), total: count, page, pages: Math.ceil(count / limit) })
  }

  /** Conteo por estado para el tablero (global para admin/moderación, del área para operativo) */
  static async summary(req: Request, res: Response) {
    const where = scopeWhere(req)
    if (!where) {
      res.json({ byStatus: [], total: 0, open: 0, area: null })
      return
    }
    const rows = (await Report.findAll({
      where,
      attributes: ['status', [fn('COUNT', col('id')), 'total']],
      group: ['status'],
      raw: true,
    })) as unknown as { status: ReportStatus; total: string }[]
    const byStatus = rows.map((r) => ({ status: r.status, total: Number(r.total) }))
    const area = req.user!.areaId ? await Area.findByPk(req.user!.areaId, { attributes: ['id', 'name', 'type'] }) : null
    res.json({
      byStatus,
      total: byStatus.reduce((a, b) => a + b.total, 0),
      open: byStatus.filter((s) => OPEN_STATUSES.includes(s.status)).reduce((a, b) => a + b.total, 0),
      area,
    })
  }

  /** Cambio de estado con observación (y evidencia opcional) */
  static async updateStatus(req: Request, res: Response) {
    const report = await loadManageable(req, res)
    if (!report) return
    const status = req.body.status as ReportStatus
    if (report.status === status) {
      res.status(400).json({ error: 'El reporte ya tiene ese estado' })
      return
    }
    // El personal operativo solo avanza la atención; cerrar, rechazar o canalizar lo decide Atención Ciudadana
    if (req.user!.role === 'operativo') {
      if (!OPERATIVO_STATUSES.includes(status)) {
        res.status(403).json({ error: 'Tu rol solo puede marcar reportes como "en atención" o "resueltos"' })
        return
      }
      if (CLOSED_STATUSES.includes(report.status)) {
        res.status(400).json({ error: 'El reporte ya está cerrado' })
        return
      }
    }
    const evidence = req.file ? await storage.saveReportImage(req.file.buffer) : null
    try {
      await changeStatus(report, status, req.user!.id, req.body.note, undefined, { internal: req.body.internal === true, evidence })
    } catch (error) {
      if (evidence) await storage.remove([evidence.imageUrl, evidence.thumbUrl, evidence.mediumUrl])
      throw error
    }
    res.json({ message: 'Estado actualizado' })
  }

  /** Observación o evidencia de los trabajos realizados, sin cambiar el estado */
  static async addUpdate(req: Request, res: Response) {
    const report = await loadManageable(req, res)
    if (!report) return
    const note = (req.body.note as string | undefined)?.trim() || null
    if (!note && !req.file) {
      res.status(400).json({ error: 'Escribe una observación o adjunta una evidencia' })
      return
    }
    const evidence = req.file ? await storage.saveReportImage(req.file.buffer) : null
    try {
      await addUpdate(report, evidence ? 'evidencia' : 'nota', req.user!.id, note, { internal: req.body.internal === true, evidence })
    } catch (error) {
      if (evidence) await storage.remove([evidence.imageUrl, evidence.thumbUrl, evidence.mediumUrl])
      throw error
    }
    res.status(201).json({ message: evidence ? 'Evidencia agregada' : 'Observación agregada' })
  }

  /** Asignar / reasignar / canalizar (solo administración) */
  static async assign(req: Request, res: Response) {
    if (!isAdmin(req.user)) {
      res.status(403).json({ error: 'Solo la administración puede asignar reportes' })
      return
    }
    const report = await Report.findByPk(req.params.reportId)
    if (!report) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    const areaId = req.body.areaId === null ? null : Number(req.body.areaId)
    const area = areaId ? await Area.findByPk(areaId) : null
    if (areaId && (!area || !area.active)) {
      res.status(400).json({ error: 'Área no válida o inactiva' })
      return
    }
    if ((area?.id ?? null) === report.areaId) {
      res.status(400).json({ error: 'El reporte ya está asignado a esa área' })
      return
    }
    await assignArea(report, area, req.user!.id, req.body.note)
    res.json({ message: area ? (area.type === 'externa' ? `Canalizado a ${area.name}` : `Asignado a ${area.name}`) : 'Asignación retirada' })
  }

  /**
   * Reportes abiertos sin movimiento en N días (para recordatorios).
   * Lo usa el panel y también n8n (vía /api/integrations con API key).
   */
  static async stale(req: Request, res: Response) {
    res.json(await findStaleReports(staleDays(req.query.days), req.user?.role === 'operativo' ? req.user.areaId : undefined))
  }
}

/** Días sin movimiento: ?days= o STALE_REPORT_DAYS (5 por defecto) */
export function staleDays(value: unknown) {
  const n = Number(value ?? process.env.STALE_REPORT_DAYS ?? 5)
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 365) : 5
}

/** Reportes abiertos cuyo último movimiento del historial es anterior a N días */
export async function findStaleReports(days: number, areaId?: number | null) {
  const cutoff = new Date(Date.now() - days * 864e5)
  const lastMove = literal(`(SELECT MAX(h."createdAt") FROM "report_history" h WHERE h."reportId" = "Report"."id")`)
  const reports = await Report.findAll({
    where: {
      status: OPEN_STATUSES,
      ...(areaId !== undefined ? { areaId } : {}),
      [Op.and]: [literal(`COALESCE((SELECT MAX(h."createdAt") FROM "report_history" h WHERE h."reportId" = "Report"."id"), "Report"."createdAt") < '${cutoff.toISOString()}'`)],
    },
    attributes: ['id', 'title', 'status', 'severity', 'colonia', 'createdAt', 'areaId', [lastMove, 'lastMovementAt']],
    include: [{ model: Area, attributes: ['id', 'name', 'type', 'contactEmail'] }],
    order: [['createdAt', 'ASC']],
    limit: 200,
  })
  return {
    days,
    total: reports.length,
    reports: reports.map((r) => {
      const json = r.toJSON() as Record<string, any>
      const last = new Date(json.lastMovementAt ?? json.createdAt)
      return { ...json, daysWithoutMovement: Math.floor((Date.now() - last.getTime()) / 864e5) }
    }),
  }
}
