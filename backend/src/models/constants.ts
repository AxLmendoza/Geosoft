/**
 * Roles:
 * - ciudadano: crea reportes y consulta los suyos
 * - operativo: personal de un área; atiende los reportes asignados a su área
 * - moderador: modera contenido (denuncias, baneos, ocultar reportes)
 * - admin: Dirección / Secretaría de Atención Ciudadana; todo
 */
export const ROLES = ['ciudadano', 'moderador', 'admin', 'operativo'] as const
export type Role = (typeof ROLES)[number]

/**
 * Estados del seguimiento. Se conservan los valores históricos para no migrar datos:
 *   pendiente   → "Reporte recibido"
 *   en_revision → "En proceso de validación"
 *   asignado    → "Asignado a un área"
 *   en_proceso  → "Atención en proceso"
 *   resuelto    → "Reporte resuelto"
 *   cerrado     → "Reporte cerrado"
 *   rechazado   → "No procedente"
 *   canalizado  → "Canalizado a otra autoridad"
 * Los valores nuevos se agregan al final del ENUM (ALTER TYPE ... ADD VALUE, no destructivo).
 */
export const REPORT_STATUS = ['pendiente', 'en_revision', 'en_proceso', 'resuelto', 'rechazado', 'asignado', 'cerrado', 'canalizado'] as const
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

/** Estados que puede poner el personal operativo en los reportes de su área */
export const OPERATIVO_STATUSES: ReportStatus[] = ['en_proceso', 'resuelto']

/** Estados que se consideran "abiertos" para estadísticas, prioridad y recordatorios */
export const OPEN_STATUSES: ReportStatus[] = ['pendiente', 'en_revision', 'asignado', 'en_proceso']

/** Estados finales: ya no admiten votos, notas del ciudadano ni acciones del autor */
export const CLOSED_STATUSES: ReportStatus[] = ['resuelto', 'cerrado', 'rechazado', 'canalizado']

/** Peso de la gravedad para el índice de priorización por zona */
export const SEVERITY_WEIGHT: Record<Severity, number> = { baja: 1, media: 2, alta: 3, critica: 5 }

/**
 * Tipo de dependencia responsable:
 * - municipal: área del propio ayuntamiento
 * - organismo: organismo descentralizado (p. ej. operador de agua potable)
 * - externa: otra autoridad (estatal, federal, CFE...). Los reportes se canalizan.
 */
export const AREA_TYPES = ['municipal', 'organismo', 'externa'] as const
export type AreaType = (typeof AREA_TYPES)[number]

/** Tipo de movimiento en el historial de seguimiento */
export const HISTORY_KINDS = ['estado', 'asignacion', 'nota', 'evidencia', 'ciudadano'] as const
export type HistoryKind = (typeof HISTORY_KINDS)[number]
