import type { User } from '../models/User'
import type { Report } from '../models/Report'

/** Moderación y administración: ven autores de reportes anónimos y moderan contenido */
export const isStaff = (user?: User | null) => !!user && (user.role === 'moderador' || user.role === 'admin')

export const isAdmin = (user?: User | null) => user?.role === 'admin'

/** Personal operativo con un área asignada */
export const isOperativo = (user?: User | null) => user?.role === 'operativo' && !!user.areaId

/**
 * ¿Puede atender (cambiar estado, agregar observaciones/evidencias) este reporte?
 * - admin y moderador: cualquiera
 * - operativo: solo los asignados a su área
 */
export function canManageReport(user: User | null | undefined, report: Pick<Report, 'areaId'>) {
  if (!user) return false
  if (isStaff(user)) return true
  return isOperativo(user) && report.areaId != null && report.areaId === user.areaId
}

/** ¿Puede ver el seguimiento completo (observaciones, evidencias, responsables)? */
export function canSeeTracking(user: User | null | undefined, report: Pick<Report, 'areaId' | 'userId'>) {
  return !!user && (user.id === report.userId || canManageReport(user, report))
}
