import { Link } from 'react-router-dom'
import { assetUrl } from '@/lib/media'
import { timeAgo } from '@/lib/date'
import { SeverityBadge, StatusBadge } from '@/components/ui/Badges'
import { HandThumbDownIcon, HandThumbUpIcon } from '@heroicons/react/24/outline'
import CategoryIcon from '@/components/CategoryIcon'
import type { Report } from '@/types'

export default function ReportCard({ report }: { report: Report }) {
  return (
    <Link
      to={`/reports/${report.id}`}
      className="group overflow-hidden rounded-2xl glass transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative">
        <img src={assetUrl(report.imageUrl)} alt={report.title} className="aspect-[4/3] w-full object-cover" loading="lazy" />
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-white shadow"
          style={{ backgroundColor: report.category.color }}
        >
          <CategoryIcon slug={report.category.slug} className="size-3.5" /> {report.category.name}
        </span>
        {report.hidden && (
          <span className="absolute right-3 top-3 rounded-full bg-slate-900/80 px-2 py-1 text-xs font-bold text-white">Oculto</span>
        )}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-1 font-bold text-slate-900 group-hover:text-indigo-700">{report.title}</h3>
        <p className="line-clamp-2 text-sm text-slate-600">{report.description}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={report.status} />
          <SeverityBadge severity={report.severity} />
          <span className="ml-auto text-xs text-slate-500">{timeAgo(report.createdAt)}</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
          <span title="Vecinos que dicen que ya quedó" className="flex items-center gap-1"><HandThumbUpIcon className="size-4" /> {report.votes.solucionado}</span>
          <span title="Vecinos que dicen que sigue igual" className="flex items-center gap-1"><HandThumbDownIcon className="size-4" /> {report.votes.sin_solucion}</span>
          {report.status === 'resuelto' && report.removalAt && (
            <span className="ml-auto text-emerald-700">Se retira {timeAgo(report.removalAt)}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
