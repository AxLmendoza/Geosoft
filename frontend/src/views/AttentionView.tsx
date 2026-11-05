import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowPathIcon, BuildingOffice2Icon, ChatBubbleLeftEllipsisIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon,
  InboxStackIcon, MagnifyingGlassIcon, MapPinIcon,
} from '@heroicons/react/24/outline'
import { getAttentionReports, getAttentionSummary, getPublicAreas, type AttentionFilters } from '@/api/AttentionAPI'
import { useAuth } from '@/hooks/useAuth'
import { OPEN_STATUSES, STATUS, STATUS_OPTIONS } from '@/lib/labels'
import { assetUrl } from '@/lib/media'
import { formatRelativeDay, timeAgo } from '@/lib/date'
import SelectBox from '@/components/ui/SelectBox'
import { SeverityBadge, StatusBadge } from '@/components/ui/Badges'
import { EmptyState, ErrorState, ListSkeleton, RefreshingBadge, Skeleton } from '@/components/ui/States'
import AttentionDialog, { type AttentionMode } from '@/components/reports/AttentionDialog'
import type { Report, ReportStatus } from '@/types'

const PAGE_SIZE = 20

export default function AttentionView() {
  const { user, isAdmin, isOperativo } = useAuth()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ReportStatus | '' | 'abiertos'>('abiertos')
  const [area, setArea] = useState<number | 'none' | 0>(0)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState<{ report: Report; mode: AttentionMode } | null>(null)

  // Espera a que deje de escribir antes de consultar
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => setPage(1), [q, status, area])

  const params: AttentionFilters = {
    q: q || undefined,
    status: status && status !== 'abiertos' ? status : undefined,
    open: status === 'abiertos' ? 'true' : undefined,
    area: area || undefined,
    page,
    limit: PAGE_SIZE,
  }

  const summary = useQuery({ queryKey: ['attention', 'summary'], queryFn: getAttentionSummary })
  const list = useQuery({
    queryKey: ['attention', 'reports', params],
    queryFn: () => getAttentionReports(params),
    placeholderData: keepPreviousData, // no deja la pantalla vacía al cambiar de página o filtro
  })
  const { data: areas = [] } = useQuery({ queryKey: ['areas', 'public'], queryFn: getPublicAreas, enabled: !isOperativo, staleTime: 5 * 60_000 })

  const areaOptions = useMemo(
    () => [{ value: 0 as const, label: 'Todas las áreas' }, { value: 'none' as const, label: 'Sin área (por clasificar)' }, ...areas.map((a) => ({ value: a.id, label: a.name }))],
    [areas],
  )
  const countFor = (s: ReportStatus) => summary.data?.byStatus.find((x) => x.status === s)?.total ?? 0

  const title = isOperativo ? summary.data?.area?.name ?? 'Mi área' : 'Bandeja de atención'
  const noArea = isOperativo && !user?.areaId

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{isOperativo ? 'Reportes asignados a' : 'Atención Ciudadana'}</p>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {title} <RefreshingBadge show={list.isFetching && !list.isLoading} />
          </h1>
        </div>
        <button onClick={() => { summary.refetch(); list.refetch() }} className="btn-sm bg-white/70 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200 hover:bg-white">
          <ArrowPathIcon className="size-4" /> Actualizar
        </button>
      </header>

      {noArea && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
          Tu usuario aún no tiene un área asignada. Pide a la administración que te asigne una para ver reportes.
        </p>
      )}

      {/* Conteo por estado: también funciona como filtro rápido */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
        {summary.isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[74px] min-w-32" />)
          : [
              { id: 'abiertos' as const, label: 'Abiertos', value: summary.data?.open ?? 0, dot: 'bg-indigo-500' },
              ...OPEN_STATUSES.map((s) => ({ id: s, label: STATUS[s].short, value: countFor(s), dot: STATUS[s].dot })),
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setStatus(c.id)}
                aria-pressed={status === c.id}
                className={`min-w-32 shrink-0 rounded-2xl p-3 text-left transition ${status === c.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'glass hover:bg-white/70'}`}
              >
                <span className={`flex items-center gap-1.5 text-xs font-bold ${status === c.id ? 'text-indigo-100' : 'text-slate-500'}`}>
                  <span className={`size-2 rounded-full ${c.dot}`} /> {c.label}
                </span>
                <span className="mt-1 block text-2xl font-extrabold tabular-nums">{c.value}</span>
              </button>
            ))}
      </div>

      <section className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-end sm:p-4">
        <label className="flex-1">
          <span className="sr-only">Buscar</span>
          <span className="relative block">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Folio, título, calle o colonia" className="input !py-2 pl-10" enterKeyHint="search" />
          </span>
        </label>
        <SelectBox
          value={status}
          onChange={setStatus}
          className="sm:w-56"
          options={[{ value: 'abiertos' as const, label: 'Solo abiertos' }, { value: '' as const, label: 'Todos los estados' }, ...STATUS_OPTIONS]}
        />
        {!isOperativo && <SelectBox value={area} onChange={setArea} className="sm:w-64" options={areaOptions} />}
      </section>

      {list.isLoading ? (
        <ListSkeleton rows={6} />
      ) : list.isError ? (
        <ErrorState message="No pudimos cargar los reportes." onRetry={() => list.refetch()} />
      ) : !list.data?.data.length ? (
        <EmptyState icon={<InboxStackIcon className="size-6" />} title="Sin reportes con estos filtros" text={status === 'abiertos' ? 'No hay reportes pendientes de atender. ¡Buen trabajo!' : undefined} />
      ) : (
        <>
          <ul className={`divide-y divide-white/60 overflow-hidden rounded-2xl glass transition-opacity ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
            {list.data.data.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <Link to={`/reports/${r.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                  <img src={assetUrl(r.thumbUrl)} alt="" loading="lazy" decoding="async" className="size-16 shrink-0 rounded-xl bg-slate-200 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900 hover:text-indigo-700">
                      <span className="text-slate-400">#{r.id}</span> {r.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={r.status} short />
                      <SeverityBadge severity={r.severity} />
                      <span className="text-xs font-bold" style={{ color: r.category.color }}>{r.category.name}</span>
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><MapPinIcon className="size-3.5" />{[r.calle, r.colonia].filter(Boolean).join(', ') || 'Sin dirección'}</span>
                      {!isOperativo && <span className="flex items-center gap-1"><BuildingOffice2Icon className="size-3.5" />{r.area?.name ?? 'Sin área'}</span>}
                      <span className="flex items-center gap-1" title={formatRelativeDay(r.createdAt)}><ClockIcon className="size-3.5" />{timeAgo(r.createdAt)}</span>
                    </p>
                  </div>
                </Link>
                <div className="flex gap-1.5 md:shrink-0">
                  <button onClick={() => setAction({ report: r, mode: 'status' })} className="btn-sm flex-1 bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 md:flex-none">
                    <ArrowPathIcon className="size-4" /> Estado
                  </button>
                  <button onClick={() => setAction({ report: r, mode: 'update' })} className="btn-sm flex-1 px-3 py-2 text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50 md:flex-none" title="Observación o evidencia">
                    <ChatBubbleLeftEllipsisIcon className="size-4" /> Nota
                  </button>
                  {isAdmin && (
                    <button onClick={() => setAction({ report: r, mode: 'assign' })} className="btn-sm flex-1 px-3 py-2 text-slate-700 ring-1 ring-slate-300 hover:bg-white/60 md:flex-none" title="Asignar o canalizar">
                      <BuildingOffice2Icon className="size-4" /> Área
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {list.data.pages > 1 && (
            <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Paginación">
              <p className="text-slate-500">{list.data.total} reportes · página {list.data.page} de {list.data.pages}</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-sm bg-white/70 px-3 py-2 ring-1 ring-slate-200 disabled:opacity-40" aria-label="Anterior">
                  <ChevronLeftIcon className="size-4" />
                </button>
                <button disabled={page >= list.data.pages} onClick={() => setPage((p) => p + 1)} className="btn-sm bg-white/70 px-3 py-2 ring-1 ring-slate-200 disabled:opacity-40" aria-label="Siguiente">
                  <ChevronRightIcon className="size-4" />
                </button>
              </div>
            </nav>
          )}
        </>
      )}

      {action && <AttentionDialog report={action.report} mode={action.mode} onClose={() => setAction(null)} />}
    </div>
  )
}
