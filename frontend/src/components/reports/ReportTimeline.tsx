import type { ComponentType, SVGProps } from 'react'
import {
  ArrowsRightLeftIcon, BuildingOffice2Icon, ChatBubbleLeftEllipsisIcon, CheckBadgeIcon, CheckIcon, ClipboardDocumentCheckIcon,
  InboxArrowDownIcon, LockClosedIcon, MagnifyingGlassIcon, NoSymbolIcon, PhotoIcon, UserIcon, WrenchScrewdriverIcon,
} from '@heroicons/react/24/solid'
import { formatDateTime, timeAgo } from '@/lib/date'
import { assetUrl } from '@/lib/media'
import { EXIT_STATUSES, HISTORY_KIND, ROLE, STATUS, TRACK_STEPS } from '@/lib/labels'
import ImageViewer from '@/components/ui/ImageViewer'
import type { Report, ReportHistoryItem, ReportStatus } from '@/types'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

const STATUS_ICON: Record<ReportStatus, Icon> = {
  pendiente: InboxArrowDownIcon,
  en_revision: MagnifyingGlassIcon,
  asignado: BuildingOffice2Icon,
  en_proceso: WrenchScrewdriverIcon,
  resuelto: CheckBadgeIcon,
  cerrado: LockClosedIcon,
  rechazado: NoSymbolIcon,
  canalizado: ArrowsRightLeftIcon,
}

/** Paso más avanzado alcanzado en la ruta normal (los pasos saltados cuentan como completados) */
function reachedStep(report: Report) {
  const statuses = [report.status, ...(report.history ?? []).map((h) => h.toStatus)]
  return Math.max(-1, ...statuses.map((s) => TRACK_STEPS.indexOf(s)))
}

/* ------------------------- Barra de progreso ------------------------- */

export function ProgressTracker({ report, compact = false }: { report: Report; compact?: boolean }) {
  const exit = EXIT_STATUSES.includes(report.status)
  // Si se reabrió, el progreso es el del estado actual
  const current = TRACK_STEPS.indexOf(report.status)
  const reached = exit ? reachedStep(report) : current >= 0 ? current : reachedStep(report)
  const pct = Math.max(0, reached) / (TRACK_STEPS.length - 1)

  return (
    <div aria-label={`Progreso: ${STATUS[report.status].label}`}>
      <div className="relative mx-3 h-1.5 rounded-full bg-slate-200">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${exit ? 'bg-slate-400' : 'bg-gradient-to-r from-indigo-500 to-emerald-500'}`}
          style={{ width: `${pct * 100}%` }}
        />
        <ol className="absolute inset-x-0 -top-[7px] flex justify-between">
          {TRACK_STEPS.map((step, i) => {
            const done = i < reached || (i === reached && (exit || step === 'cerrado'))
            const active = i === reached && !exit && step !== 'cerrado'
            return (
              <li key={step} className="relative flex flex-col items-center" aria-current={active ? 'step' : undefined}>
                <span
                  className={`flex size-5 items-center justify-center rounded-full ring-4 ring-white transition ${
                    done ? 'bg-indigo-600 text-white' : active ? 'bg-white ring-indigo-500' : 'bg-slate-200'
                  } ${active ? 'outline outline-2 outline-indigo-500' : ''}`}
                >
                  {done && <CheckIcon className="size-3" />}
                  {active && <span className="size-2 animate-pulse rounded-full bg-indigo-600" />}
                </span>
                {!compact && (
                  <span
                    className={`absolute top-7 hidden w-20 text-center text-xs font-bold leading-tight sm:block ${
                      active ? 'text-indigo-700' : done ? 'text-slate-700' : 'text-slate-400'
                    } ${i === 0 ? 'left-0 text-left' : i === TRACK_STEPS.length - 1 ? 'right-0 text-right' : ''}`}
                  >
                    {STATUS[step].short}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </div>
      {!compact && (
        <>
          <div className="hidden h-10 sm:block" />
          {/* En pantallas angostas no caben 6 etiquetas: se indica el paso actual */}
          <p className="mt-4 text-center text-xs font-bold text-slate-600 sm:hidden">
            {exit ? `Seguimiento finalizado: ${STATUS[report.status].short}` : `Paso ${Math.max(reached, 0) + 1} de ${TRACK_STEPS.length}: ${STATUS[TRACK_STEPS[Math.max(reached, 0)]].short}`}
          </p>
        </>
      )}
    </div>
  )
}

/* ------------------------- Estado actual ------------------------- */

export function CurrentStatusCard({ report }: { report: Report }) {
  const s = STATUS[report.status]
  const Icon = STATUS_ICON[report.status]
  const last = report.history?.at(-1)
  return (
    <div className="flex items-start gap-3">
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${s.className}`}>
        <Icon className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-extrabold leading-tight text-slate-900">{s.label}</p>
        <p className="text-sm text-slate-600">{s.help}</p>
        <p className="mt-1 text-xs text-slate-500">
          {report.area ? (
            <>
              Responsable: <b className="text-slate-700">{report.area.name}</b>
            </>
          ) : (
            'Aún sin área responsable'
          )}
          {last && <> · Última actualización {timeAgo(last.createdAt)}</>}
        </p>
      </div>
    </div>
  )
}

/* ------------------------- Historial ------------------------- */

function actorLabel(h: ReportHistoryItem) {
  if (h.isYou) return 'Tú'
  if (!h.changedBy) return h.kind === 'asignacion' ? 'Asignación automática' : 'Sistema'
  const { name, role, area } = h.changedBy
  if (name) return [name, ROLE[role], area?.name].filter(Boolean).join(' · ')
  if (role === 'ciudadano') return 'Ciudadano'
  return area ? `${ROLE[role]} · ${area.name}` : ROLE[role]
}

function entryTitle(h: ReportHistoryItem) {
  if (h.kind === 'asignacion') {
    if (!h.toArea) return 'Se retiró el área asignada'
    const verb = h.toStatus === 'canalizado' ? 'Canalizado a' : h.fromArea ? 'Reasignado a' : 'Asignado a'
    return `${verb} ${h.toArea.name}`
  }
  if (h.kind === 'estado') return STATUS[h.toStatus].label
  return HISTORY_KIND[h.kind]
}

function entryIcon(h: ReportHistoryItem): { Icon: Icon; className: string } {
  if (h.kind === 'estado') return { Icon: STATUS_ICON[h.toStatus], className: STATUS[h.toStatus].className }
  if (h.kind === 'asignacion') return { Icon: BuildingOffice2Icon, className: STATUS.asignado.className }
  if (h.kind === 'evidencia') return { Icon: PhotoIcon, className: 'bg-teal-100 text-teal-700 ring-teal-600/20' }
  if (h.kind === 'ciudadano') return { Icon: UserIcon, className: 'bg-amber-50 text-amber-700 ring-amber-600/20' }
  return { Icon: ChatBubbleLeftEllipsisIcon, className: 'bg-slate-100 text-slate-600 ring-slate-500/20' }
}

export function HistoryList({ history }: { history: ReportHistoryItem[] }) {
  // Lo más reciente arriba, como en las apps de seguimiento
  const items = [...history].reverse()
  if (!items.length) return <p className="text-sm text-slate-500">Sin movimientos todavía.</p>
  return (
    <ol className="relative space-y-5">
      <span className="absolute bottom-2 left-[17px] top-2 w-0.5 bg-slate-200" aria-hidden />
      {items.map((h, i) => {
        const { Icon, className } = entryIcon(h)
        return (
          <li key={h.id} className="relative flex gap-3">
            <span className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${className} ${i === 0 ? 'shadow-md' : ''}`}>
              <Icon className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="font-bold text-slate-900">{entryTitle(h)}</p>
                {h.internal && (
                  <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white" title="Solo la ve el personal">
                    <LockClosedIcon className="size-3" /> Interna
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                <time dateTime={h.createdAt}>{formatDateTime(h.createdAt)}</time> · {actorLabel(h)}
              </p>
              {h.note && <p className="mt-1.5 whitespace-pre-line rounded-xl bg-white/60 px-3 py-2 text-sm text-slate-700 ring-1 ring-white/80">{h.note}</p>}
              {h.imageUrl && (
                <ImageViewer
                  src={assetUrl(h.imageUrl)}
                  thumbSrc={assetUrl(h.thumbUrl ?? h.imageUrl)}
                  alt={`Evidencia: ${h.note ?? entryTitle(h)}`}
                  className="mt-2 size-24 rounded-xl ring-1 ring-slate-200"
                  thumbClassName="size-24 object-cover"
                />
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Bloque completo: estado actual + barra de progreso + historial */
export default function ReportTimeline({ report }: { report: Report }) {
  return (
    <section className="card space-y-6" aria-labelledby="seguimiento">
      <h2 id="seguimiento" className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
        <ClipboardDocumentCheckIcon className="size-6 text-indigo-600" /> Seguimiento
      </h2>
      <CurrentStatusCard report={report} />
      <ProgressTracker report={report} />
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Historial de movimientos</h3>
        <HistoryList history={report.history ?? []} />
        {!report.isOwner && !report.canManage && (
          <p className="mt-4 text-xs text-slate-500">Las observaciones y evidencias solo las ve quien hizo el reporte y el personal responsable.</p>
        )}
      </div>
    </section>
  )
}
