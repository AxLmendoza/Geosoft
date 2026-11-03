import type { FlagReason, ReportStatus, Role, Severity } from '@/types'

export const STATUS: Record<ReportStatus, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-800 ring-amber-600/20' },
  en_revision: { label: 'En revisión', className: 'bg-sky-100 text-sky-800 ring-sky-600/20' },
  en_proceso: { label: 'En proceso', className: 'bg-indigo-100 text-indigo-800 ring-indigo-600/20' },
  resuelto: { label: 'Resuelto', className: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20' },
  rechazado: { label: 'Rechazado', className: 'bg-slate-200 text-slate-700 ring-slate-500/20' },
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
  moderador: 'Moderador',
  admin: 'Administrador',
}

export const STATUS_OPTIONS = Object.entries(STATUS).map(([value, v]) => ({ value: value as ReportStatus, label: v.label }))
export const SEVERITY_OPTIONS = Object.entries(SEVERITY).map(([value, v]) => ({ value: value as Severity, label: v.label }))
