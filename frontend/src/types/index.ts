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

/**
 * Confirmación ciudadana ("Confirmar que se resolvió" / "El problema continúa").
 * Es informativa: nunca cambia el estado oficial.
 */
export type VoteSummary = {
  solucionado: number
  sin_solucion: number
  /** Respuesta del usuario actual y cuándo la dio */
  mine: VoteValue | null
  mineAt?: string | null
  /** Respuestas dadas después de que el reporte se marcó como resuelto */
  afterResolution?: { solucionado: number; sin_solucion: number }
  /** Respuesta de quien hizo el reporte */
  owner?: VoteValue | null
}

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
  updatedAt?: string
  reportsCount?: number
  areaId?: number | null
  /** false = cuenta desactivada por la administración (no puede iniciar sesión) */
  active?: boolean
  lastLoginAt?: string | null
}

/** Estado de una cuenta del personal (lo calcula el backend) */
export type AccountStatus = 'activo' | 'invitacion_pendiente' | 'invitacion_vencida' | 'sin_confirmar' | 'desactivado' | 'suspendido'

export type StaffMember = {
  id: number
  name: string
  email: string
  role: Role
  area: (AreaRef & { active?: boolean }) | null
  status: AccountStatus
  active: boolean
  confirmed: boolean
  banned: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  invitedAt: string | null
  inviteExpiresAt: string | null
  /** Reportes abiertos asignados directamente a esta persona */
  openAssigned: number
  isSelf: boolean
}

export type StaffDetail = StaffMember & {
  invitedBy: { id: number; name: string } | null
  areaOpenReports: number
  assignedReports: Pick<Report, 'id' | 'title' | 'status' | 'severity' | 'createdAt'>[]
}

export type InvitationResult = { sent: boolean; reason?: string; warning?: string | null }

export type StaffMeta = {
  mail: { provider?: 'brevo' | 'smtp'; configured: boolean; missing: string[]; sandbox: boolean; frontendUrl: boolean }
  inviteTtlHours: number
  assignableRoles: ('operativo' | 'moderador')[]
}

export type StaffActivity = {
  audit: { id: number; action: string; targetType: string; targetId: number | null; details: Record<string, unknown> | null; createdAt: string; actor: { id: number; name: string } | null }[]
  attention: { id: number; kind: HistoryKind; fromStatus: ReportStatus | null; toStatus: ReportStatus; createdAt: string; report: { id: number; title: string | null } }[]
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
  /** Responsable directo (solo lo recibe el personal que puede atender el reporte) */
  assignee?: { id: number; name: string | null; active: boolean } | null
  votes: VoteSummary
  /** Figura como resuelto pero un ciudadano indicó después que el problema continúa */
  needsReview?: boolean
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
  /** Resueltos en los que un ciudadano indicó que el problema continúa */
  needsReview?: number
  /** Abiertos asignados directamente a quien consulta */
  mine?: number
  area: AreaRef | null
}
