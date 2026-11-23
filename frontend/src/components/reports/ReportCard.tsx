import { memo } from 'react'
import { Link } from 'react-router-dom'
import { BuildingOffice2Icon, ClockIcon } from '@heroicons/react/24/outline'
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
      className="gs-reveal group flex h-full flex-col overflow-hidden rounded-2xl glass glass-hover hover:-translate-y-1 active:translate-y-0 active:scale-[0.99] lg:rounded-[1.5rem]"
    >
      <div className="relative overflow-hidden bg-slate-100">
        <img
          src={cardImage(report)}
          alt={report.title}
          className="aspect-[16/10] w-full object-cover transition duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
          loading="lazy"
          decoding="async"
        />
        {/* Degradado para que las etiquetas sobre la foto siempre se lean */}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-night/55 via-transparent to-night/30" aria-hidden />
        {/* Brillo de cristal que cruza la foto al pasar el cursor */}
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_35%,rgb(255_255_255/0.22)_50%,transparent_65%)] transition-transform duration-1000 ease-out group-hover:translate-x-full" aria-hidden />
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-2.5 text-xs font-semibold text-white shadow-lift ring-1 ring-white/25 backdrop-blur"
          style={{ backgroundColor: report.category.color }}
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-white/20">
            <CategoryIcon slug={report.category.slug} className="size-3.5" />
          </span>
          {report.category.name}
        </span>
        {report.hidden && (
          <span className="absolute right-3 top-3 rounded-full bg-night/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">Oculto</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-slate-900 transition-colors group-hover:text-brand-700">
            {report.title}
          </h3>
          <span className="mt-0.5 flex shrink-0 items-center gap-1 text-xs text-slate-500">
            <ClockIcon className="size-3.5" aria-hidden /> {timeAgo(report.createdAt)}
          </span>
        </div>
        <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">{report.description}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={report.status} />
          <SeverityBadge severity={report.severity} />
        </div>
        {showProgress && (
          <div className="mt-auto space-y-2.5 border-t border-line pt-3">
            <ProgressTracker report={report} compact />
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <BuildingOffice2Icon className="size-4 shrink-0" aria-hidden /> {report.area?.name ?? 'Área por asignar'}
            </p>
          </div>
        )}
        {!showProgress && (report.needsReview || report.status === 'resuelto') && (
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs font-semibold">
            {report.needsReview ? (
              <span className="text-amber-800">Un ciudadano indica que el problema continúa</span>
            ) : (report.votes.afterResolution?.solucionado ?? 0) > 0 ? (
              <span className="text-emerald-700">Solución confirmada por ciudadanos</span>
            ) : null}
            {report.status === 'resuelto' && report.removalAt && (
              <span className="ml-auto font-normal text-slate-500">Se retira del mapa {timeAgo(report.removalAt)}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

export default memo(ReportCard)
