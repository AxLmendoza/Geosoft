import { CheckIcon } from '@heroicons/react/20/solid'
import { formatDateTime, formatRelativeDay, timeAgo } from '@/lib/date'
import { assetUrl } from '@/lib/media'
import { EXIT_STATUSES, HISTORY_KIND, ROLE, STATUS, TRACK_STEPS } from '@/lib/labels'
import { useCategories } from '@/hooks/useCategories'
import ImageViewer from '@/components/ui/ImageViewer'
import type { Report, ReportHistoryItem, ReportStatus } from '@/types'

/** Paso más avanzado alcanzado en la ruta normal (los pasos saltados cuentan como completados) */
function reachedIndex(report: Report) {
  const exit = EXIT_STATUSES.includes(report.status)
  const current = TRACK_STEPS.indexOf(report.status)
  if (!exit && current >= 0) return current // si se reabrió, manda el estado actual
  const statuses = [report.status, ...(report.history ?? []).map((h) => h.toStatus)]
  return Math.max(0, ...statuses.map((s) => TRACK_STEPS.indexOf(s)))
}

/** Primera vez que el reporte llegó a cada etapa (para mostrar la fecha en la línea vertical) */
function reachedAt(history: ReportHistoryItem[] = []) {
  const map = new Map<ReportStatus, string>()
  for (const h of history) if (!map.has(h.toStatus) && (h.kind === 'estado' || h.kind === 'asignacion')) map.set(h.toStatus, h.createdAt)
  return map
}

type StepState = 'done' | 'current' | 'todo'

function stepStates(report: Report): StepState[] {
  const exit = EXIT_STATUSES.includes(report.status)
  const reached = reachedIndex(report)
  return TRACK_STEPS.map((step, i) => {
    if (i < reached) return 'done'
    if (i === reached) return exit || step === 'cerrado' ? 'done' : 'current'
    return 'todo'
  })
}

function Dot({ state }: { state: StepState }) {
  if (state === 'done')
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-indigo-600 text-white">
        <CheckIcon className="size-4" aria-hidden />
      </span>
    )
  if (state === 'current')
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-white ring-2 ring-indigo-600">
        <span className="size-2.5 rounded-full bg-indigo-600" />
      </span>
    )
  return <span className="block size-6 rounded-full border-2 border-slate-300 bg-white" />
}

/* ----------------------------- Progreso ----------------------------- */

/**
 * Indicador de etapas adaptable al ancho de SU contenedor (container queries):
 * - Contenedor ancho (≥ 36rem): barra horizontal con el nombre de cada etapa.
 * - Contenedor angosto (celular o columna lateral): línea vertical con nombre y fecha.
 * - compact (tarjetas): una barra y el texto del paso actual.
 */
export function ProgressTracker({ report, compact = false }: { report: Report; compact?: boolean }) {
  const exit = EXIT_STATUSES.includes(report.status)
  const states = stepStates(report)
  const reached = reachedIndex(report)
  const pct = (reached / (TRACK_STEPS.length - 1)) * 100

  if (compact) {
    return (
      <div aria-label={`Progreso: ${STATUS[report.status].label}`}>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${exit ? 'bg-slate-400' : 'bg-indigo-600'}`} style={{ width: `${Math.max(pct, 6)}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-slate-600">
          {exit ? <>Finalizado · <b>{STATUS[report.status].short}</b></> : <>Paso {reached + 1} de {TRACK_STEPS.length} · <b>{STATUS[TRACK_STEPS[reached]].short}</b></>}
        </p>
      </div>
    )
  }

  const dates = reachedAt(report.history)

  return (
    <div className="@container" aria-label={`Progreso: ${STATUS[report.status].label}`}>
      {/* Horizontal (contenedor ancho) */}
      <ol className="hidden @xl:flex">
        {TRACK_STEPS.map((step, i) => (
          <li key={step} className="relative flex flex-1 flex-col items-center text-center" aria-current={states[i] === 'current' ? 'step' : undefined}>
            {i > 0 && <span className={`absolute right-1/2 top-3 h-0.5 w-full ${states[i] === 'todo' ? 'bg-slate-200' : 'bg-indigo-600'}`} aria-hidden />}
            <span className="relative"><Dot state={states[i]} /></span>
            <span className={`mt-2 px-1 text-xs leading-tight ${states[i] === 'current' ? 'font-bold text-indigo-700' : states[i] === 'done' ? 'font-medium text-slate-700' : 'text-slate-400'}`}>
              {STATUS[step].short}
            </span>
          </li>
        ))}
      </ol>

      {/* Vertical (celular / columna angosta) */}
      <ol className="space-y-0 @xl:hidden">
        {TRACK_STEPS.map((step, i) => {
          const state = states[i]
          const last = i === TRACK_STEPS.length - 1
          return (
            <li key={step} className="relative flex gap-3 pb-4 last:pb-0" aria-current={state === 'current' ? 'step' : undefined}>
              {!last && <span className={`absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 ${states[i + 1] === 'todo' ? 'bg-slate-200' : 'bg-indigo-600'}`} aria-hidden />}
              <span className="relative z-10 shrink-0"><Dot state={state} /></span>
              <div className="min-w-0 pt-0.5">
                <p className={`text-sm leading-tight ${state === 'current' ? 'font-bold text-indigo-700' : state === 'done' ? 'font-medium text-slate-800' : 'text-slate-400'}`}>
                  {STATUS[step].label}
                </p>
                {state !== 'todo' && dates.get(step) && <p className="text-xs text-slate-500">{formatRelativeDay(dates.get(step)!)}</p>}
                {state === 'current' && <p className="mt-0.5 text-xs text-slate-600">{STATUS[step].help}</p>}
              </div>
            </li>
          )
        })}
      </ol>

      {exit && (
        <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
          <b>{STATUS[report.status].label}.</b> {STATUS[report.status].help}
        </p>
      )}
    </div>
  )
}

/* ----------------------------- Estado actual ----------------------------- */

/**
 * Explica quién lo atiende. Si no hay área no se inventa una: se dice por qué
 * (autoridad externa por confirmar, categoría sin área o reporte anterior a la asignación automática).
 */
function AreaLine({ report }: { report: Report }) {
  const { data: categories = [] } = useCategories()
  if (report.area) {
    return <>Responsable: <b className="font-semibold text-slate-800">{report.area.name}</b></>
  }
  const suggested = categories.find((c) => c.id === report.categoryId)?.area
  if (suggested?.type === 'externa') return <>Por confirmar: podría corresponder a <b className="font-semibold text-slate-800">{suggested.name}</b></>
  return <>Atención Ciudadana asignará el área responsable</>
}

export function CurrentStatusCard({ report }: { report: Report }) {
  const s = STATUS[report.status]
  const last = report.history?.at(-1)
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado actual</p>
      <p className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-900">
        <span className={`size-2.5 rounded-full ${s.dot}`} aria-hidden /> {s.label}
      </p>
      <p className="mt-1 text-sm text-slate-600"><AreaLine report={report} /></p>
      {last && <p className="text-xs text-slate-500">Última actualización {timeAgo(last.createdAt)}</p>}
    </div>
  )
}

/* ----------------------------- Historial ----------------------------- */

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

export function HistoryList({ history }: { history: ReportHistoryItem[] }) {
  // Lo más reciente arriba, como en las apps de seguimiento
  const items = [...history].reverse()
  if (!items.length) return <p className="text-sm text-slate-500">Sin movimientos todavía.</p>
  return (
    <ol className="space-y-4">
      {items.map((h) => (
        <li key={h.id} className="border-l-2 border-slate-200 pl-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold text-slate-900">{entryTitle(h)}</p>
            {h.internal && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white" title="Solo la ve el personal">Nota interna</span>}
          </div>
          <p className="text-xs text-slate-500">
            <time dateTime={h.createdAt}>{formatDateTime(h.createdAt)}</time> · {actorLabel(h)}
          </p>
          {h.note && <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700">{h.note}</p>}
          {h.imageUrl && (
            <ImageViewer
              src={assetUrl(h.imageUrl)}
              thumbSrc={assetUrl(h.thumbUrl ?? h.imageUrl)}
              alt={`Evidencia: ${h.note ?? entryTitle(h)}`}
              className="mt-2 size-24 rounded-lg border border-slate-200"
              thumbClassName="size-24 object-cover"
            />
          )}
        </li>
      ))}
    </ol>
  )
}

/** Bloque completo: estado actual + etapas + historial */
export default function ReportTimeline({ report }: { report: Report }) {
  return (
    <section className="card space-y-6" aria-labelledby="seguimiento">
      <h2 id="seguimiento" className="sr-only">Seguimiento</h2>
      <CurrentStatusCard report={report} />
      <ProgressTracker report={report} />
      <div className="border-t border-slate-200 pt-5">
        <h3 className="mb-3 text-sm font-bold text-slate-900">Historial de movimientos</h3>
        <HistoryList history={report.history ?? []} />
        {!report.isOwner && !report.canManage && (
          <p className="mt-4 text-xs text-slate-500">Las observaciones y evidencias solo las ve quien hizo el reporte y el personal responsable.</p>
        )}
      </div>
    </section>
  )
}
