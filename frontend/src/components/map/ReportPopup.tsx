import { Link } from 'react-router-dom'
import { CalendarDaysIcon, MapPinIcon, UserCircleIcon } from '@heroicons/react/20/solid'
import { assetUrl } from '@/lib/media'
import { formatDateTime, timeAgo } from '@/lib/date'
import { SeverityBadge, StatusBadge } from '@/components/ui/Badges'
import CategoryIcon from '@/components/CategoryIcon'
import CommunityVotes from '@/components/reports/CommunityVotes'
import ResolvedNotice from '@/components/reports/ResolvedNotice'
import type { Report } from '@/types'

export default function ReportPopup({ report }: { report: Report }) {
  return (
    <div className="w-64 overflow-hidden">
      <img src={assetUrl(report.imageUrl)} alt={report.title} className="h-40 w-full object-cover" loading="lazy" />
      <div className="space-y-2 p-3">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-white"
          style={{ backgroundColor: report.category.color }}
        >
          <CategoryIcon slug={report.category.slug} className="size-3.5" />
          {report.category.name}
        </span>
        <h3 className="text-base font-bold leading-tight text-slate-900">{report.title}</h3>
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={report.status} />
          <SeverityBadge severity={report.severity} />
        </div>
        <p className="flex items-center gap-1 text-xs text-slate-500" title={formatDateTime(report.createdAt)}>
          <CalendarDaysIcon className="size-4" /> {timeAgo(report.createdAt)}
        </p>
        {(report.colonia || report.calle) && (
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <MapPinIcon className="size-4 shrink-0" /> {[report.calle, report.colonia].filter(Boolean).join(', ')}
          </p>
        )}
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <UserCircleIcon className="size-4" /> {report.author ? report.author.name : 'Anónimo'}
        </p>
        <ResolvedNotice report={report} compact />
        <CommunityVotes report={report} compact />
        <Link
          to={`/reports/${report.id}`}
          className="block rounded-lg bg-indigo-600 py-2 text-center text-sm font-bold !text-white hover:bg-indigo-700"
        >
          Ver detalle
        </Link>
      </div>
    </div>
  )
}
