export type Role = 'ciudadano' | 'moderador' | 'admin'
export type ReportStatus = 'pendiente' | 'en_revision' | 'en_proceso' | 'resuelto' | 'rechazado'
export type Severity = 'baja' | 'media' | 'alta' | 'critica'
export type FlagReason = 'informacion_falsa' | 'imagen_inapropiada' | 'spam_basura' | 'duplicado' | 'otro'
export type FlagStatus = 'pendiente' | 'procedente' | 'descartada'
export type VoteValue = 'solucionado' | 'sin_solucion'

export type VoteSummary = { solucionado: number; sin_solucion: number; mine: VoteValue | null }

export type User = {
  id: number
  name: string
  email: string
  role: Role
  confirmed: boolean
  banned: boolean
  bannedReason: string | null
  bannedAt: string | null
  createdAt: string
  reportsCount?: number
}

export type Category = {
  id: number
  name: string
  slug: string
  color: string
  description?: string | null
}

export type Author = { id: number; name: string; email?: string; banned?: boolean } | null

export type ReportHistoryItem = {
  id: number
  fromStatus: ReportStatus | null
  toStatus: ReportStatus
  note: string | null
  createdAt: string
  changedBy: { id?: number; name?: string; role: Role } | null
}

export type Report = {
  id: number
  title: string
  description: string
  imageUrl: string
  thumbUrl: string
  lat: number
  lng: number
  colonia: string | null
  calle: string | null
  severity: Severity
  status: ReportStatus
  anonymous: boolean
  hidden: boolean
  hiddenReason?: string | null
  categoryId: number
  category: Pick<Category, 'id' | 'name' | 'slug' | 'color'>
  author: Author
  isOwner: boolean
  votes: VoteSummary
  /** Fecha en que se marcó como resuelto */
  resolvedAt: string | null
  /** Cuándo se retira del mapa público (solo si está resuelto) */
  removalAt: string | null
  /** Borrado lógico (solo lo ve el staff) */
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
  history?: ReportHistoryItem[]
  flags?: { id: number; status: FlagStatus; reason: FlagReason }[]
}

export type Flag = {
  id: number
  reason: FlagReason
  comment: string | null
  status: FlagStatus
  createdAt: string
  reporter: { id: number; name: string; email: string }
  reviewedBy: { id: number; name: string } | null
  report: Report | null
}

export type BlacklistEntry = {
  id: number
  email: string
  reason: string
  createdAt: string
  createdBy: { id: number; name: string } | null
}

export type ReportFilters = {
  category?: number
  status?: ReportStatus
  severity?: Severity
}

export type LoginForm = { email: string; password: string }
export type RegisterForm = { name: string; email: string; password: string; password_confirmation: string }
export type NewPasswordForm = { password: string; password_confirmation: string }

export type NewReportForm = {
  title: string
  description: string
  categoryId: number
  severity: Severity
  colonia: string
  calle: string
  anonymous: boolean
}

export type AdminStats = {
  range: { from: string; to: string }
  totals: {
    total: number
    resueltos: number
    abiertos: number
    rechazados: number
    ocultos: number
    eliminados: number
    tasaResolucion: number
    promedioHorasSolucion: number | null
    votos: number
    usuarios: number
    moderadores: number
    baneados: number
    denunciasPendientes: number
  }
  monthly: { month: string; reportados: number; resueltos: number }[]
  byCategory: { id: number; name: string; color: string; total: number; resueltos: number; abiertos: number }[]
  byStatus: { status: ReportStatus; total: number }[]
  bySeverity: { severity: Severity; total: number }[]
  priorityZones: { colonia: string; abiertos: number; criticos: number; indice: number }[]
}
