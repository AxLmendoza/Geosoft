import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BuildingOffice2Icon, MapPinIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { cardImage } from '@/lib/media'
import { SEVERITY, STATUS } from '@/lib/labels'
import CategoryIcon from '@/components/CategoryIcon'
import { PinBadge, pinKind } from './pinIcons'
import type { Report } from '@/types'

/** Dato con icono y etiqueta para lector de pantalla (el icono nunca va solo) */
function Fact({ icon: Icon, label, children }: { icon: typeof MapPinIcon; label: string; children: ReactNode }) {
  return (
    <p className="flex min-w-0 items-start gap-1.5 text-[13px] leading-snug text-slate-700">
      <Icon className="mt-px size-4 shrink-0 text-slate-400" aria-hidden />
      <span className="sr-only">{label}: </span>
      <span className="line-clamp-1 min-w-0">{children}</span>
    </p>
  )
}

/** Foto completa (sin recortar) sobre fondo neutro; si no carga, un aviso discreto en su lugar */
function Photo({ report, className }: { report: Report; className: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}>
        <PhotoIcon className="size-6" aria-hidden />
        <span className="sr-only">Foto no disponible</span>
      </div>
    )
  }
  const src = cardImage(report)
  // Foto completa (object-contain); el espacio sobrante se llena con la misma foto desenfocada
  return (
    <div className={`relative overflow-hidden bg-slate-200 ${className}`}>
      <img src={src} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-70 blur-xl" decoding="async" />
      <img
        src={src}
        alt={`Foto del reporte: ${report.title}`}
        className="relative size-full object-contain"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

type Props = { report: Report; onClose: () => void; /** 'sheet' = hoja inferior del celular (foto en miniatura) */ layout?: 'popup' | 'sheet' }

/**
 * Tarjeta del reporte seleccionado: lo justo para reconocer el problema y decidir si abrir el detalle.
 */
export default function ReportPopup({ report, onClose, layout = 'popup' }: Props) {
  const kind = pinKind(report)
  const place = [report.calle, report.colonia].filter(Boolean).join(', ')
  const severe = report.severity === 'critica' || report.severity === 'alta'
  const sheet = layout === 'sheet'

  const close = (
    <button
      type="button"
      onClick={onClose}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/95 text-slate-600 ring-1 ring-line transition-colors hover:bg-slate-100 hover:text-slate-950"
      aria-label="Cerrar tarjeta"
    >
      <XMarkIcon className="size-5" aria-hidden />
    </button>
  )

  const body = (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 pt-0.5 text-xs font-semibold text-slate-600">
          <CategoryIcon slug={report.category.slug} className="size-3.5 shrink-0 text-slate-500" />
          <span className="truncate">{report.category.name}</span>
          <span className="shrink-0 font-normal text-slate-400">#{report.id}</span>
        </p>
        {sheet && close}
      </div>
      <h3 id={`popup-title-${report.id}`} className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-slate-900">{report.title}</h3>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-slate-800 ring-1 ring-inset ring-line">
          <PinBadge kind={kind === 'critico' ? pinKind({ status: report.status, severity: 'media' }) : kind} size={18} />
          {STATUS[report.status].short}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
            report.severity === 'critica' ? 'bg-red-50 text-red-800 ring-red-200' : report.severity === 'alta' ? 'bg-orange-50 text-orange-800 ring-orange-200' : 'bg-white text-slate-600 ring-line'
          }`}
        >
          {report.severity === 'critica' && <PinBadge kind="critico" size={14} />}
          Prioridad {SEVERITY[report.severity].label.toLowerCase()}
          {severe && <span className="sr-only"> (atención prioritaria)</span>}
        </span>
      </div>

      {report.needsReview && (
        <p className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200">Un ciudadano indica que el problema continúa</p>
      )}

      {(place || report.area) && (
        <div className="space-y-1">
          {place && <Fact icon={MapPinIcon} label="Ubicación">{place}</Fact>}
          {report.area && <Fact icon={BuildingOffice2Icon} label="Área responsable">{report.area.name}</Fact>}
        </div>
      )}

      <Link to={`/reports/${report.id}`} className="btn-primary btn-compact w-full">Ver detalle</Link>
    </div>
  )

  if (sheet) {
    return (
      <article className="gs-card flex gap-3 p-3" aria-labelledby={`popup-title-${report.id}`}>
        <Photo report={report} className="size-20 shrink-0 rounded-xl" />
        {body}
      </article>
    )
  }

  return (
    <article className="gs-card" aria-labelledby={`popup-title-${report.id}`}>
      <div className="relative">
        <Photo report={report} className="aspect-[2/1] w-full" />
        <div className="absolute right-2 top-2">{close}</div>
      </div>
      <div className="p-3.5">{body}</div>
    </article>
  )
}

/** Varios reportes en el mismo punto (no se separan ni con el zoom máximo): lista para elegir */
export function ReportPickList({ reports, onPick, onClose }: { reports: Report[]; onPick: (r: Report) => void; onClose: () => void }) {
  return (
    <div className="gs-card" role="dialog" aria-label={`${reports.length} reportes en este punto`}>
      <header className="flex items-center justify-between gap-2 border-b border-line py-2 pl-3.5 pr-2">
        <p className="text-sm font-semibold text-slate-900">{reports.length} reportes en este punto</p>
        <button type="button" onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-950" aria-label="Cerrar lista">
          <XMarkIcon className="size-5" aria-hidden />
        </button>
      </header>
      <ul className="max-h-64 divide-y divide-line overflow-y-auto overscroll-contain">
        {reports.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onPick(r)} className="flex min-h-12 w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-50 focus-visible:bg-slate-50">
              <PinBadge kind={pinKind(r)} size={22} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{r.title}</span>
                <span className="block truncate text-xs text-slate-500">{r.category.name}, {STATUS[r.status].short.toLowerCase()}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
