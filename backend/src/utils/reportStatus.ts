import { Op, type Transaction } from 'sequelize'
import { db } from '../config/db'
import { Report } from '../models/Report'
import { ReportHistory } from '../models/ReportHistory'
import { Area } from '../models/Area'
import type { Category } from '../models/Category'
import type { HistoryKind, ReportStatus } from '../models/constants'
import { emitReportEvent } from '../services/events'

/** Días que un reporte resuelto/cerrado sigue visible en el mapa público */
export const resolvedVisibleDays = () => Number(process.env.RESOLVED_VISIBLE_DAYS ?? 2)

/** Estados que, pasados N días, se retiran del mapa público */
const RETIRED_STATUSES: ReportStatus[] = ['resuelto', 'cerrado']

export const isRetiredStatus = (status: ReportStatus) => RETIRED_STATUSES.includes(status)

/** Fecha en la que un reporte resuelto deja de verse en el mapa */
export const removalDate = (resolvedAt: Date | null) =>
  resolvedAt ? new Date(new Date(resolvedAt).getTime() + resolvedVisibleDays() * 864e5) : null

/** Condición para el mapa público: visible y, si está resuelto/cerrado, que no hayan pasado los N días */
export function publicVisibilityWhere() {
  const cutoff = new Date(Date.now() - resolvedVisibleDays() * 864e5)
  return {
    hidden: false,
    [Op.or]: [{ status: { [Op.notIn]: RETIRED_STATUSES } }, { resolvedAt: { [Op.gt]: cutoff } }],
  }
}

/** resolvedAt: se fija al resolver, se conserva al cerrar y se limpia si se reabre */
function nextResolvedAt(report: Report, toStatus: ReportStatus) {
  if (toStatus === 'resuelto') return new Date()
  if (toStatus === 'cerrado') return report.resolvedAt ?? new Date()
  return null
}

type Evidence = { imageUrl: string; thumbUrl: string } | null | undefined

/** Ejecuta en la transacción recibida o abre una nueva */
const inTx = <T>(transaction: Transaction | undefined, fn: (t: Transaction) => Promise<T>) =>
  transaction ? fn(transaction) : db.transaction(fn)

/**
 * Único lugar donde cambia el estado: guarda el historial (seguimiento)
 * y maneja resolvedAt. Lo usan el autor, el personal operativo, moderación y el admin.
 */
export async function changeStatus(
  report: Report,
  toStatus: ReportStatus,
  actorId: number | null,
  note?: string | null,
  transaction?: Transaction,
  opts: { internal?: boolean; evidence?: Evidence } = {},
) {
  const fromStatus = report.status
  await inTx(transaction, async (t) => {
    await ReportHistory.create(
      {
        reportId: report.id,
        kind: 'estado',
        fromStatus,
        toStatus,
        note: note || null,
        internal: !!opts.internal,
        imageUrl: opts.evidence?.imageUrl ?? null,
        thumbUrl: opts.evidence?.thumbUrl ?? null,
        changedById: actorId,
      },
      { transaction: t },
    )
    await report.update({ status: toStatus, resolvedAt: nextResolvedAt(report, toStatus) }, { transaction: t })
  })
  emitReportEvent('report.status_changed', report.id, { fromStatus, toStatus, note: opts.internal ? null : note || null }, transaction)
}

/**
 * Asigna (o reasigna) el área responsable y lo registra en el historial.
 * - Área externa → el reporte queda "canalizado a otra autoridad"
 * - Reporte aún sin atender → pasa a "asignado"
 * - Reporte ya en atención → conserva su estado (solo cambia de área)
 */
export async function assignArea(
  report: Report,
  area: Area | null,
  actorId: number | null,
  note?: string | null,
  transaction?: Transaction,
) {
  const fromAreaId = report.areaId
  const fromStatus = report.status
  let toStatus: ReportStatus = fromStatus
  if (area?.type === 'externa') toStatus = 'canalizado'
  else if (area && ['pendiente', 'en_revision', 'canalizado'].includes(fromStatus)) toStatus = 'asignado'
  else if (!area && fromStatus === 'asignado') toStatus = 'pendiente'

  const defaultNote = area
    ? area.type === 'externa'
      ? `Canalizado a ${area.name}`
      : `Asignado a ${area.name}`
    : 'Se retiró la asignación de área'

  await inTx(transaction, async (t) => {
    await ReportHistory.create(
      {
        reportId: report.id,
        kind: 'asignacion',
        fromStatus,
        toStatus,
        fromAreaId,
        toAreaId: area?.id ?? null,
        note: note || defaultNote,
        changedById: actorId,
      },
      { transaction: t },
    )
    await report.update(
      {
        areaId: area?.id ?? null,
        assignedAt: area ? new Date() : null,
        assignedById: actorId,
        status: toStatus,
        resolvedAt: toStatus === fromStatus ? report.resolvedAt : nextResolvedAt(report, toStatus),
      },
      { transaction: t },
    )
  })
  emitReportEvent('report.assigned', report.id, { fromAreaId, toAreaId: area?.id ?? null, fromStatus, toStatus }, transaction)
}

/**
 * Observación sin cambio de estado: nota del personal, evidencia fotográfica
 * o información adicional del ciudadano.
 */
export async function addUpdate(
  report: Report,
  kind: Extract<HistoryKind, 'nota' | 'evidencia' | 'ciudadano'>,
  actorId: number,
  note: string | null,
  opts: { internal?: boolean; evidence?: Evidence } = {},
) {
  const entry = await ReportHistory.create({
    reportId: report.id,
    kind,
    fromStatus: report.status,
    toStatus: report.status,
    note: note || null,
    internal: kind === 'ciudadano' ? false : !!opts.internal,
    imageUrl: opts.evidence?.imageUrl ?? null,
    thumbUrl: opts.evidence?.thumbUrl ?? null,
    changedById: actorId,
  })
  // Marca el reporte como "con movimiento" (útil para recordatorios de reportes estancados)
  report.changed('updatedAt', true)
  await report.save()
  if (!opts.internal) emitReportEvent('report.updated', report.id, { kind, note })
  return entry
}

/**
 * Asignación automática al crear un reporte, según el área configurada en su categoría.
 * Las autoridades externas no se canalizan solas: quedan como sugerencia para que
 * Atención Ciudadana confirme (evita cerrar reportes por una clasificación errónea).
 */
export async function autoAssign(report: Report, category: Category, transaction: Transaction) {
  if (process.env.AUTO_ASSIGN_REPORTS === 'false' || !category.areaId) return
  const area = await Area.findByPk(category.areaId, { transaction })
  if (!area || !area.active) return

  if (area.type === 'externa') {
    await ReportHistory.create(
      {
        reportId: report.id,
        kind: 'nota',
        fromStatus: report.status,
        toStatus: report.status,
        note: `Por su categoría, este reporte podría corresponder a ${area.name}. Atención Ciudadana confirmará si se canaliza.`,
        internal: false,
        changedById: null,
      },
      { transaction },
    )
    return
  }
  await assignArea(report, area, null, `Asignado automáticamente a ${area.name} por la categoría "${category.name}"`, transaction)
}
