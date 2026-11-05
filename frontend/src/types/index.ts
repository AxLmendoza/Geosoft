export type Role = 'ciudadano' | 'moderador' | 'admin' | 'operativo'
export type ReportStatus = 'pendiente' | 'en_revision' | 'asignado' | 'en_proceso' | 'resuelto' | 'cerrado' | 'rechazado' | 'canalizado'
export type AreaType = 'municipal' | 'organismo' | 'externa'
export type HistoryKind = 'estado' | 'asignacion' | 'nota' | 'evidencia' | 'ciudadano'

export type AreaRef = { id: number; name: string; type?: AreaType }

export type Area = {
  id: number
  name: string
  slug: string
  type: AreaType
  description: string | null
  contactEmail: string | null
  active: boolean
  membersCount?: number
  categoriesCount?: number
  openReports?: number
}
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
  areaId?: number | null
}

export type Category = {
  id: number
  name: string
  slug: string
  color: string
  description?: string | null
  areaId?: number | null
  area?: AreaRef | null
}

export type Author = { id: number; name: string; email?: string; banned?: boolean } | null

export type ReportHistoryItem = {
  id: number
  kind: HistoryKind
  fromStatus: ReportStatus | null
  toStatus: ReportStatus
  note: string | null
  internal: boolean
  imageUrl: string | null
  thumbUrl: string | null
  fromArea: AreaRef | null
  toArea: AreaRef | null
  createdAt: string
  isYou: boolean
  /** null = movimiento automático del sistema */
  changedBy: { id?: number; name?: string; role: Role; area: AreaRef | null } | null
}

export type Report = {
  id: number
  title: string
  description: string
  imageUrl: string
  thumbUrl: string
  /** Versión ~640px para tarjetas (null en reportes antiguos) */
  mediumUrl?: string | null
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
  /** El usuario actual puede atenderlo (admin, moderación o su área) */
  canManage: boolean
  area: AreaRef | null
  assignedAt?: string | null
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
    operativos: number
    baneados: number
    denunciasPendientes: number
  }
  monthly: { month: string; reportados: number; resueltos: number }[]
  byCategory: { id: number; name: string; color: string; total: number; resueltos: number; abiertos: number }[]
  byArea: { id: number | null; name: string; type: AreaType | null; total: number; abiertos: number; resueltos: number; promedioHorasSolucion: number | null }[]
  byStatus: { status: ReportStatus; total: number }[]
  bySeverity: { severity: Severity; total: number }[]
  priorityZones: { colonia: string; abiertos: number; criticos: number; indice: number }[]
}

export type Paginated<T> = { data: T[]; total: number; page: number; pages: number }

export type AttentionSummary = {
  byStatus: { status: ReportStatus; total: number }[]
  total: number
  open: number
  area: AreaRef | null
}
