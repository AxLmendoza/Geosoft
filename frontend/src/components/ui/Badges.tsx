import { CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, NoSymbolIcon, PauseCircleIcon } from '@heroicons/react/20/solid'
import { ACCOUNT_STATUS, STATUS, SEVERITY } from '@/lib/labels'
import type { AccountStatus, ReportStatus, Severity } from '@/types'

export function StatusBadge({ status, short = false }: { status: ReportStatus; short?: boolean }) {
  const s = STATUS[status]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.className}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden />
      {short ? s.short : s.label}
    </span>
  )
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-current/15 ${s.className}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden />
      <span className="sr-only">Gravedad </span>
      {s.label}
    </span>
  )
}

const ACCOUNT_ICON: Record<AccountStatus, typeof CheckCircleIcon> = {
  activo: CheckCircleIcon,
  invitacion_pendiente: ClockIcon,
  invitacion_vencida: ExclamationTriangleIcon,
  sin_confirmar: ClockIcon,
  desactivado: PauseCircleIcon,
  suspendido: NoSymbolIcon,
}

/** Estado de una cuenta: icono + texto (no depende solo del color) */
export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const s = ACCOUNT_STATUS[status]
  const Icon = ACCOUNT_ICON[status]
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full py-0.5 pl-1.5 pr-2.5 text-xs font-semibold ring-1 ring-inset ${s.className}`}>
      <Icon className="size-3.5" aria-hidden />
      {s.label}
    </span>
  )
}
