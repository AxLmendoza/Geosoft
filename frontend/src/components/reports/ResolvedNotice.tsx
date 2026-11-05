import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import { formatDateTime, timeAgo } from '@/lib/date'
import type { Report } from '@/types'

/** "Solucionado hace 3 horas · se retira del mapa en 2 días" */
export default function ResolvedNotice({ report, compact = false }: { report: Report; compact?: boolean }) {
  if ((report.status !== 'resuelto' && report.status !== 'cerrado') || !report.resolvedAt) return null
  const gone = report.removalAt && new Date(report.removalAt) < new Date()
  return (
    <div className={`flex items-start gap-2 rounded-xl bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 ${compact ? 'p-2 text-xs' : 'p-3 text-sm'}`}>
      <CheckBadgeIcon className={`${compact ? 'size-4' : 'size-5'} shrink-0 text-emerald-600`} />
      <p>
        <b>Solucionado</b> <span title={formatDateTime(report.resolvedAt)}>{timeAgo(report.resolvedAt)}</span>
        {report.removalAt && (
          <span className="text-emerald-700"> · {gone ? 'ya no aparece en el mapa' : `se retira del mapa ${timeAgo(report.removalAt)}`}</span>
        )}
      </p>
    </div>
  )
}
