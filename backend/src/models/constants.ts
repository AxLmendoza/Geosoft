export const ROLES = ['ciudadano', 'moderador', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const REPORT_STATUS = ['pendiente', 'en_revision', 'en_proceso', 'resuelto', 'rechazado'] as const
export type ReportStatus = (typeof REPORT_STATUS)[number]

export const SEVERITY = ['baja', 'media', 'alta', 'critica'] as const
export type Severity = (typeof SEVERITY)[number]

export const FLAG_REASONS = ['informacion_falsa', 'imagen_inapropiada', 'spam_basura', 'duplicado', 'otro'] as const
export type FlagReason = (typeof FLAG_REASONS)[number]

export const FLAG_STATUS = ['pendiente', 'procedente', 'descartada'] as const
export type FlagStatus = (typeof FLAG_STATUS)[number]

/** Voto de la comunidad: "👏 ya quedó" o "sigue igual" */
export const VOTE_VALUES = ['solucionado', 'sin_solucion'] as const
export type VoteValue = (typeof VOTE_VALUES)[number]

/** Estados que puede poner el propio autor del reporte */
export const OWNER_STATUSES = ['en_proceso', 'resuelto'] as const

/** Estados que se consideran "abiertos" para estadísticas y prioridad */
export const OPEN_STATUSES: ReportStatus[] = ['pendiente', 'en_revision', 'en_proceso']

/** Peso de la gravedad para el índice de priorización por zona */
export const SEVERITY_WEIGHT: Record<Severity, number> = { baja: 1, media: 2, alta: 3, critica: 5 }
