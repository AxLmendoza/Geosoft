import { STATUS, SEVERITY } from '@/lib/labels'
import type { ReportStatus, Severity } from '@/types'

export function StatusBadge({ status }: { status: ReportStatus }) {
  const s = STATUS[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.className}`}>
      {s.label}
    </span>
  )
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}
