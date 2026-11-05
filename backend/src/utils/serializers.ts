import type { Report } from '../models/Report'
import type { ReportHistory } from '../models/ReportHistory'
import type { User } from '../models/User'
import type { VoteSummary } from './votes'
import { isRetiredStatus, removalDate } from './reportStatus'
import { canManageReport, canSeeTracking, isStaff } from './permissions'

export { isStaff }

/**
 * Historial según quién lo consulta:
 * - Personal que atiende el reporte (admin, moderación, área asignada): todo, con nombres.
 * - Autor: todo menos notas internas; del personal solo ve rol y área.
 * - Público: solo cambios de estado y de área, sin observaciones ni evidencias.
 */
export function serializeHistory(history: ReportHistory[], report: Report, viewer?: User | null) {
  const manager = canManageReport(viewer, report)
  const full = canSeeTracking(viewer, report)
  return history
    .filter((h) => (manager ? true : full ? !h.internal : h.kind === 'estado' || h.kind === 'asignacion'))
    .map((h) => {
      const by = h.changedBy
      const area = by?.area ? { id: by.area.id, name: by.area.name } : null
      return {
        id: h.id,
        kind: h.kind ?? 'estado',
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        note: full ? h.note : null,
        internal: manager ? h.internal : false,
        imageUrl: full ? h.imageUrl : null,
        thumbUrl: full ? h.thumbUrl : null,
        fromArea: h.fromArea ? { id: h.fromArea.id, name: h.fromArea.name } : null,
        toArea: h.toArea ? { id: h.toArea.id, name: h.toArea.name } : null,
        createdAt: h.createdAt,
        isYou: !!viewer && h.changedById === viewer.id,
        // null = movimiento automático del sistema
        changedBy: by ? (manager ? { id: by.id, name: by.name, role: by.role, area } : { role: by.role, area }) : null,
      }
    })
}

/**
 * Convierte un reporte a JSON respetando el anonimato:
 * el autor solo se muestra si no es anónimo, si lo ve su dueño
 * o si lo ve un moderador/admin.
 */
export function serializeReport(report: Report, viewer?: User | null, votes?: VoteSummary) {
  const json = report.toJSON() as Record<string, any>
  const staff = isStaff(viewer)
  const isOwner = !!viewer && viewer.id === report.userId
  const showAuthor = !report.anonymous || staff || isOwner

  json.lat = Number(json.lat)
  json.lng = Number(json.lng)
  json.isOwner = isOwner
  json.canManage = canManageReport(viewer, report)
  json.votes = votes ?? { solucionado: 0, sin_solucion: 0, mine: null }
  // Cuándo se retira del mapa público (solo si está resuelto o cerrado)
  json.removalAt = isRetiredStatus(report.status) ? removalDate(report.resolvedAt) : null
  json.area = report.area ? { id: report.area.id, name: report.area.name, type: report.area.type } : null
  json.author = showAuthor && report.user
    ? { id: report.user.id, name: report.user.name, ...(staff ? { email: report.user.email, banned: report.user.banned } : {}) }
    : null
  if (report.history) json.history = serializeHistory(report.history, report, viewer)

  delete json.user
  if (!showAuthor) delete json.userId
  if (!json.canManage) delete json.assignedById
  if (!staff) {
    delete json.hiddenReason
    delete json.flags
    delete json.deletedById
  }
  return json
}
