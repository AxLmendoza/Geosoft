import type { User } from '../models/User'
import type { Report } from '../models/Report'

/**
 * MATRIZ DE ACCESO (la interfaz solo oculta botones; todo se valida en el backend)
 *
 * Recurso / acción                         ciudadano   operativo        moderador   admin
 * ---------------------------------------  ----------  ---------------  ----------  -----
 * Mapa público, detalle público            sí          sí               sí          sí
 * Crear reporte, "mis reportes"            sí          sí               sí          sí
 * Seguimiento completo de un reporte       solo suyos  solo su área     todos       todos
 * Bandeja de atención (/attention)         no          solo su área     todos       todos
 * Cambiar estado / notas / evidencias      no          su área (*)      todos       todos
 * Asignar área o responsable               no          no               no          sí
 * Moderación (denuncias, ocultar, vetar)   no          no               sí (**)     sí
 * Responsables, roles y auditoría          no          no               no          sí
 * Áreas, categorías, estadísticas, CRUD    no          no               no          sí
 *
 * (*)  El operativo solo pone "en atención" o "resuelto". El área sale SIEMPRE de su cuenta
 *      (req.user.areaId), nunca de parámetros de la petición; fuera de su área responde 404.
 * (**) El moderador solo sanciona ciudadanos.
 * Reglas de cuentas: nadie modifica su propio rol ni se desactiva a sí mismo; el rol de
 * administrador no se asigna desde la API; nunca queda la plataforma sin un admin activo.
 * Una cuenta desactivada o suspendida no pasa `authenticate` aunque su JWT siga vigente.
 */

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
