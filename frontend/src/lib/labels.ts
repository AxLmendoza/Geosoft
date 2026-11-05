import type { AreaType, FlagReason, HistoryKind, ReportStatus, Role, Severity } from '@/types'

/** Etiqueta, descripción para el ciudadano y colores de cada estado */
export const STATUS: Record<ReportStatus, { label: string; short: string; help: string; className: string; dot: string }> = {
  pendiente: {
    label: 'Reporte recibido', short: 'Recibido', help: 'Recibimos tu reporte y está en la fila de revisión.',
    className: 'bg-amber-100 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500',
  },
  en_revision: {
    label: 'En validación', short: 'En validación', help: 'Atención Ciudadana está verificando la información.',
    className: 'bg-sky-100 text-sky-800 ring-sky-600/20', dot: 'bg-sky-500',
  },
  asignado: {
    label: 'Asignado a un área', short: 'Asignado', help: 'El área responsable ya tiene tu reporte.',
    className: 'bg-violet-100 text-violet-800 ring-violet-600/20', dot: 'bg-violet-500',
  },
  en_proceso: {
    label: 'Atención en proceso', short: 'En atención', help: 'El personal está trabajando en la solución.',
    className: 'bg-indigo-100 text-indigo-800 ring-indigo-600/20', dot: 'bg-indigo-500',
  },
  resuelto: {
    label: 'Reporte resuelto', short: 'Resuelto', help: 'El problema se marcó como solucionado.',
    className: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20', dot: 'bg-emerald-500',
  },
  cerrado: {
    label: 'Reporte cerrado', short: 'Cerrado', help: 'El seguimiento terminó.',
    className: 'bg-slate-200 text-slate-700 ring-slate-500/20', dot: 'bg-slate-500',
  },
  rechazado: {
    label: 'No procedente', short: 'No procedente', help: 'El reporte no procede (duplicado, incompleto o fuera de competencia).',
    className: 'bg-rose-100 text-rose-800 ring-rose-600/20', dot: 'bg-rose-500',
  },
  canalizado: {
    label: 'Canalizado a otra autoridad', short: 'Canalizado', help: 'Corresponde a otra dependencia y se le turnó.',
    className: 'bg-cyan-100 text-cyan-800 ring-cyan-600/20', dot: 'bg-cyan-500',
  },
}

/** Ruta "feliz" de la línea de tiempo, como el seguimiento de un pedido */
export const TRACK_STEPS: ReportStatus[] = ['pendiente', 'en_revision', 'asignado', 'en_proceso', 'resuelto', 'cerrado']

/** Estados que terminan el seguimiento fuera de la ruta normal */
export const EXIT_STATUSES: ReportStatus[] = ['rechazado', 'canalizado']

export const CLOSED_STATUSES: ReportStatus[] = ['resuelto', 'cerrado', 'rechazado', 'canalizado']
export const OPEN_STATUSES: ReportStatus[] = ['pendiente', 'en_revision', 'asignado', 'en_proceso']
export const isClosed = (s: ReportStatus) => CLOSED_STATUSES.includes(s)

/** Estados que puede poner el personal operativo (lo valida también el backend) */
export const OPERATIVO_STATUSES: ReportStatus[] = ['en_proceso', 'resuelto']

export const HISTORY_KIND: Record<HistoryKind, string> = {
  estado: 'Cambio de estado',
  asignacion: 'Asignación de área',
  nota: 'Observación',
  evidencia: 'Evidencia del trabajo',
  ciudadano: 'Información del ciudadano',
}

export const AREA_TYPE: Record<AreaType, { label: string; className: string }> = {
  municipal: { label: 'Municipal', className: 'bg-indigo-50 text-indigo-700' },
  organismo: { label: 'Organismo descentralizado', className: 'bg-teal-50 text-teal-700' },
  externa: { label: 'Otra autoridad', className: 'bg-cyan-50 text-cyan-700' },
}

export const SEVERITY: Record<Severity, { label: string; className: string; dot: string }> = {
  baja: { label: 'Baja', className: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  media: { label: 'Media', className: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  alta: { label: 'Alta', className: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  critica: { label: 'Crítica', className: 'bg-red-100 text-red-800', dot: 'bg-red-600' },
}

export const FLAG_REASON: Record<FlagReason, string> = {
  informacion_falsa: 'Información falsa',
  imagen_inapropiada: 'Imagen no apta',
  spam_basura: 'Datos basura / spam',
  duplicado: 'Reporte duplicado',
  otro: 'Otro motivo',
}

export const ROLE: Record<Role, string> = {
  ciudadano: 'Ciudadano',
  operativo: 'Personal operativo',
  moderador: 'Moderador',
  admin: 'Administrador',
}

/** Orden lógico (no el del ENUM de la BD) */
const STATUS_ORDER: ReportStatus[] = [...TRACK_STEPS, ...EXIT_STATUSES]
export const STATUS_OPTIONS = STATUS_ORDER.map((value) => ({ value, label: STATUS[value].label }))
export const SEVERITY_OPTIONS = Object.entries(SEVERITY).map(([value, v]) => ({ value: value as Severity, label: v.label }))
