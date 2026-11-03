import { Op, type Transaction } from 'sequelize'
import { db } from '../config/db'
import { Report } from '../models/Report'
import { ReportHistory } from '../models/ReportHistory'
import type { ReportStatus } from '../models/constants'

/** Días que un reporte resuelto sigue visible en el mapa público */
export const resolvedVisibleDays = () => Number(process.env.RESOLVED_VISIBLE_DAYS ?? 2)

/** Fecha en la que un reporte resuelto deja de verse en el mapa */
export const removalDate = (resolvedAt: Date | null) =>
  resolvedAt ? new Date(new Date(resolvedAt).getTime() + resolvedVisibleDays() * 864e5) : null

/** Condición para el mapa público: visible y, si está resuelto, que no hayan pasado los N días */
export function publicVisibilityWhere() {
  const cutoff = new Date(Date.now() - resolvedVisibleDays() * 864e5)
  return {
    hidden: false,
    [Op.or]: [{ status: { [Op.ne]: 'resuelto' } }, { resolvedAt: { [Op.gt]: cutoff } }],
  }
}

/**
 * Único lugar donde cambia el estado: guarda el historial (seguimiento)
 * y maneja resolvedAt. Lo usan el autor, los moderadores y el admin.
 */
export async function changeStatus(
  report: Report,
  toStatus: ReportStatus,
  actorId: number,
  note?: string | null,
  transaction?: Transaction,
) {
  const run = async (t: Transaction) => {
    await ReportHistory.create(
      { reportId: report.id, fromStatus: report.status, toStatus, note: note || null, changedById: actorId },
      { transaction: t },
    )
    await report.update(
      { status: toStatus, resolvedAt: toStatus === 'resuelto' ? new Date() : null },
      { transaction: t },
    )
  }
  if (transaction) return run(transaction)
  return db.transaction(run)
}
