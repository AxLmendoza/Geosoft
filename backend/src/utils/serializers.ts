import type { Report } from '../models/Report'
import type { User } from '../models/User'
import type { VoteSummary } from './votes'
import { removalDate } from './reportStatus'

export const isStaff = (user?: User | null) => !!user && (user.role === 'moderador' || user.role === 'admin')

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
  json.votes = votes ?? { solucionado: 0, sin_solucion: 0, mine: null }
  // Cuándo se retira del mapa público (solo si está resuelto)
  json.removalAt = report.status === 'resuelto' ? removalDate(report.resolvedAt) : null
  json.author = showAuthor && report.user
    ? { id: report.user.id, name: report.user.name, ...(staff ? { email: report.user.email, banned: report.user.banned } : {}) }
    : null

  delete json.user
  if (!showAuthor) delete json.userId
  if (!staff) {
    delete json.hiddenReason
    delete json.flags
    delete json.deletedById
  }
  return json
}
