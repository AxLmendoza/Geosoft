import { memo } from 'react'
import { Link } from 'react-router-dom'
import { BuildingOffice2Icon, HandThumbDownIcon, HandThumbUpIcon } from '@heroicons/react/24/outline'
import { cardImage } from '@/lib/media'
import { timeAgo } from '@/lib/date'
import { SeverityBadge, StatusBadge } from '@/components/ui/Badges'
import CategoryIcon from '@/components/CategoryIcon'
import { ProgressTracker } from './ReportTimeline'
import type { Report } from '@/types'

/** memo: en listas largas solo se vuelve a dibujar la tarjeta cuyo reporte cambió */
function ReportCard({ report, showProgress = false }: { report: Report; showProgress?: boolean }) {
  return (
    <Link
      to={`/reports/${report.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl glass transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-500"
    >
      <div className="relative">
        <img src={cardImage(report)} alt={report.title} className="aspect-[4/3] w-full bg-slate-200 object-cover" loading="lazy" decoding="async" />
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
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-1 font-bold text-slate-900 group-hover:text-indigo-700">{report.title}</h3>
        <p className="line-clamp-2 text-sm text-slate-600">{report.description}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={report.status} />
          <SeverityBadge severity={report.severity} />
          <span className="ml-auto text-xs text-slate-500">{timeAgo(report.createdAt)}</span>
        </div>
        {showProgress && (
          <div className="mt-auto space-y-2 pt-2">
            <ProgressTracker report={report} compact />
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <BuildingOffice2Icon className="size-4 shrink-0" /> {report.area?.name ?? 'Área por asignar'}
            </p>
          </div>
        )}
        {!showProgress && (
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
            <span title="Vecinos que dicen que ya quedó" className="flex items-center gap-1"><HandThumbUpIcon className="size-4" /> {report.votes.solucionado}</span>
            <span title="Vecinos que dicen que sigue igual" className="flex items-center gap-1"><HandThumbDownIcon className="size-4" /> {report.votes.sin_solucion}</span>
            {report.status === 'resuelto' && report.removalAt && (
              <span className="ml-auto text-emerald-700">Se retira {timeAgo(report.removalAt)}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

export default memo(ReportCard)
