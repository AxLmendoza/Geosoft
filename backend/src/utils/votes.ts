import { Op, QueryTypes, literal } from 'sequelize'
import { db } from '../config/db'
import { ReportVote } from '../models/ReportVote'
import type { VoteValue } from '../models/constants'
import type { User } from '../models/User'

/**
 * Confirmación ciudadana: cada persona responde una vez por reporte
 * "se resolvió" (solucionado) o "el problema continúa" (sin_solucion).
 * Es informativa: NUNCA cambia el estado oficial del reporte.
 */
export type VoteSummary = {
  /** Totales históricos (compatibilidad con moderación y estadísticas) */
  solucionado: number
  sin_solucion: number
  /** Respuesta del usuario que consulta y cuándo la dio */
  mine: VoteValue | null
  mineAt: Date | null
  /** Respuestas dadas después de que el reporte se marcó como resuelto */
  afterResolution: { solucionado: number; sin_solucion: number }
  /** Respuesta de quien hizo el reporte (no revela su identidad) */
  owner: VoteValue | null
}

export const emptySummary = (): VoteSummary => ({
  solucionado: 0,
  sin_solucion: 0,
  mine: null,
  mineAt: null,
  afterResolution: { solucionado: 0, sin_solucion: 0 },
  owner: null,
})

type Row = { reportId: number; value: VoteValue; isOwner: boolean; afterResolution: boolean; count: string }

/** Respuestas de muchos reportes en 2 consultas (sin N+1) */
export async function getVoteSummaries(reportIds: number[], viewer?: User | null) {
  const map = new Map<number, VoteSummary>()
  reportIds.forEach((id) => map.set(id, emptySummary()))
  if (reportIds.length === 0) return map

  const rows = await db.query<Row>(
    `SELECT v."reportId", v."value",
            (v."userId" = r."userId") AS "isOwner",
            (r."resolvedAt" IS NOT NULL AND v."updatedAt" >= r."resolvedAt") AS "afterResolution",
            COUNT(*) AS "count"
       FROM "report_votes" v
       JOIN "reports" r ON r."id" = v."reportId"
      WHERE v."reportId" IN (:ids)
      GROUP BY 1, 2, 3, 4`,
    { replacements: { ids: reportIds }, type: QueryTypes.SELECT },
  )
  rows.forEach((r) => {
    const s = map.get(r.reportId)
    if (!s) return
    const n = Number(r.count)
    s[r.value] += n
    if (r.afterResolution) s.afterResolution[r.value] += n
    if (r.isOwner) s.owner = r.value
  })

  if (viewer) {
    const mine = await ReportVote.findAll({ where: { reportId: reportIds, userId: viewer.id }, attributes: ['reportId', 'value', 'updatedAt'] })
    mine.forEach((v) => {
      const s = map.get(v.reportId)
      if (s) {
        s.mine = v.value
        s.mineAt = v.updatedAt
      }
    })
  }
  return map
}

/**
 * Condición SQL (alias "Report"): figura como resuelto/cerrado y, después de la resolución,
 * algún ciudadano indicó que el problema continúa. Es la señal de revisión.
 */
export const needsReviewWhere = () =>
  literal(`("Report"."status" IN ('resuelto','cerrado') AND EXISTS (
    SELECT 1 FROM "report_votes" v
     WHERE v."reportId" = "Report"."id" AND v."value" = 'sin_solucion'
       AND "Report"."resolvedAt" IS NOT NULL AND v."updatedAt" >= "Report"."resolvedAt"))`)

/** ¿Este reporte resuelto tiene la señal "el problema continúa"? */
export async function hasNeedsReview(report: { id?: number; resolvedAt: Date | null }) {
  if (!report.resolvedAt) return false
  const n = await ReportVote.count({
    where: { reportId: report.id, value: 'sin_solucion', updatedAt: { [Op.gte]: report.resolvedAt } },
  })
  return n > 0
}
