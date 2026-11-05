import type { ComponentType, SVGProps } from 'react'
import {
  BuildingOffice2Icon, ChartBarIcon, HomeIcon, InboxStackIcon, MapIcon, RectangleStackIcon, ShieldCheckIcon,
  TableCellsIcon, UsersIcon,
} from '@heroicons/react/24/outline'
import type { Role } from '@/types'

type Icon = ComponentType<SVGProps<SVGSVGElement>>
export type NavLinkItem = { to: string; label: string; icon: Icon; end?: boolean }
export type NavGroup = { title?: string; items: NavLinkItem[] }

const MAPA: NavLinkItem = { to: '/', label: 'Mapa de reportes', icon: MapIcon, end: true }
const MIS_REPORTES: NavLinkItem = { to: '/reports/mine', label: 'Mis reportes', icon: RectangleStackIcon }

/**
 * Secciones visibles por rol (solo navegación: los permisos reales los valida el backend).
 * - Ciudadano: reportar y dar seguimiento.
 * - Operativo: los reportes de su área.
 * - Moderación: contenido y usuarios.
 * - Administración: supervisar, asignar, configurar y analizar.
 */
export function navFor(role?: Role): NavGroup[] {
  switch (role) {
    case 'admin':
      return [
        { items: [{ to: '/admin', label: 'Resumen', icon: HomeIcon, end: true }, MAPA] },
        {
          title: 'Reportes',
          items: [
            { to: '/attention', label: 'Bandeja de atención', icon: InboxStackIcon },
            { to: '/admin/reports', label: 'Registro de reportes', icon: TableCellsIcon },
          ],
        },
        {
          title: 'Supervisión',
          items: [
            { to: '/moderation', label: 'Moderación', icon: ShieldCheckIcon },
            { to: '/users', label: 'Usuarios', icon: UsersIcon },
            { to: '/admin/stats', label: 'Estadísticas', icon: ChartBarIcon },
          ],
        },
        { title: 'Configuración', items: [{ to: '/admin/areas', label: 'Áreas y categorías', icon: BuildingOffice2Icon }] },
      ]
    case 'moderador':
      return [
        { items: [{ to: '/attention', label: 'Bandeja de atención', icon: InboxStackIcon }, MAPA] },
        {
          title: 'Moderación',
          items: [
            { to: '/moderation', label: 'Denuncias y contenido', icon: ShieldCheckIcon },
            { to: '/users', label: 'Usuarios', icon: UsersIcon },
          ],
        },
        { items: [MIS_REPORTES] },
      ]
    case 'operativo':
      return [{ items: [{ to: '/attention', label: 'Reportes de mi área', icon: InboxStackIcon }, MAPA] }, { items: [MIS_REPORTES] }]
    case 'ciudadano':
      return [{ items: [MAPA, MIS_REPORTES] }]
    default:
      return [{ items: [MAPA] }]
  }
}

/** Pantalla de inicio después de iniciar sesión */
export function homeFor(role?: Role) {
  if (role === 'admin') return '/admin'
  if (role === 'operativo' || role === 'moderador') return '/attention'
  return '/'
}

/** ¿El rol tiene "Nuevo reporte" como acción principal? (ciudadanos y visitantes) */
export const reportsFirst = (role?: Role) => !role || role === 'ciudadano'
