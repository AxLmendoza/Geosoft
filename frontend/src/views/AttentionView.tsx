import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getAttentionReports, getAttentionSummary, getPublicAreas, type AttentionFilters } from '@/api/AttentionAPI'
import { useAuth } from '@/hooks/useAuth'
import { OPEN_STATUSES, SEVERITY, STATUS, STATUS_OPTIONS } from '@/lib/labels'
import { assetUrl } from '@/lib/media'
import { timeAgo } from '@/lib/date'
import SelectBox from '@/components/ui/SelectBox'
import Pagination from '@/components/ui/Pagination'
import { StatusBadge } from '@/components/ui/Badges'
import { EmptyState, ErrorState, ListSkeleton, RefreshingBadge } from '@/components/ui/States'
import AttentionDialog, { type AttentionMode } from '@/components/reports/AttentionDialog'
import type { Report, ReportStatus } from '@/types'

const PAGE_SIZE = 20
type Show = 'abiertos' | 'sin_area' | 'todos' | ReportStatus

export default function AttentionView() {
  const { user, isAdmin, isOperativo } = useAuth()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [show, setShow] = useState<Show>('abiertos')
  const [area, setArea] = useState<number | 0>(0)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState<{ report: Report; mode: AttentionMode } | null>(null)

  // Espera a que deje de escribir antes de consultar
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => setPage(1), [q, show, area])

  const params: AttentionFilters = {
    q: q || undefined,
    status: show !== 'abiertos' && show !== 'sin_area' && show !== 'todos' ? show : undefined,
    open: show === 'abiertos' || show === 'sin_area' ? 'true' : undefined,
    area: show === 'sin_area' ? 'none' : area || undefined,
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

  const countFor = (s: ReportStatus) => summary.data?.byStatus.find((x) => x.status === s)?.total ?? 0
  const withCount = (label: string, n?: number) => (summary.data && n !== undefined ? `${label} (${n})` : label)

  const showOptions = useMemo(
    () => [
      { value: 'abiertos' as Show, label: withCount('Pendientes de terminar', summary.data?.open) },
      ...(isOperativo ? [] : [{ value: 'sin_area' as Show, label: 'Sin área asignada' }]),
      ...OPEN_STATUSES.map((s) => ({ value: s as Show, label: withCount(STATUS[s].label, countFor(s)) })),
      ...STATUS_OPTIONS.filter((o) => !OPEN_STATUSES.includes(o.value)).map((o) => ({ value: o.value as Show, label: o.label })),
      { value: 'todos' as Show, label: 'Todos' },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summary.data, isOperativo],
  )
  const areaOptions = useMemo(() => [{ value: 0, label: 'Todas las áreas' }, ...areas.map((a) => ({ value: a.id, label: a.name }))], [areas])

  const title = isOperativo ? summary.data?.area?.name ?? 'Reportes de mi área' : 'Bandeja de atención'
  const noArea = isOperativo && !user?.areaId

  return (
    <div className="space-y-6">
      <header>
        {isOperativo && <p className="text-sm font-medium text-slate-500">Reportes asignados a</p>}
        <h1 className="page-title flex items-center gap-2">{title} <RefreshingBadge show={list.isFetching && !list.isLoading} /></h1>
        {!isOperativo && <p className="page-subtitle">Clasifica, asigna y da seguimiento a los reportes de todas las áreas.</p>}
        {summary.data && (
          <p className="mt-2 text-sm text-slate-600">
            <b className="text-slate-900">{summary.data.open}</b> abiertos · <b className="text-slate-900">{countFor('pendiente') + countFor('en_revision')}</b> por atender · <b className="text-slate-900">{countFor('asignado') + countFor('en_proceso')}</b> en atención
          </p>
        )}
      </header>

      {noArea && (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          Tu usuario aún no tiene un área asignada. Pide a la administración que te asigne una para ver reportes.
        </p>
      )}

      <section className={`glass grid gap-3 rounded-xl p-4 ${isOperativo ? 'sm:grid-cols-[1fr_16rem]' : 'sm:grid-cols-2 lg:grid-cols-[1fr_16rem_16rem]'}`}>
        <label className={isOperativo ? '' : 'sm:col-span-2 lg:col-span-1'}>
          <span className="label">Buscar</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Folio, título, calle o colonia" className="input !py-2" type="search" enterKeyHint="search" />
        </label>
        <SelectBox label="Mostrar" value={show} onChange={setShow} options={showOptions} />
        {!isOperativo && show !== 'sin_area' && <SelectBox label="Área" value={area} onChange={setArea} options={areaOptions} />}
      </section>

      {list.isLoading ? (
        <ListSkeleton rows={6} />
      ) : list.isError ? (
        <ErrorState message="No pudimos cargar los reportes." onRetry={() => list.refetch()} />
      ) : !list.data?.data.length ? (
        <EmptyState title="No hay reportes con estos filtros" text={show === 'abiertos' ? 'No hay reportes pendientes de atender.' : undefined} />
      ) : (
        <ul className={`divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white transition-opacity ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
          {list.data.data.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
              <Link to={`/reports/${r.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                <img src={assetUrl(r.thumbUrl)} alt="" loading="lazy" decoding="async" className="size-14 shrink-0 rounded-lg bg-slate-200 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 hover:text-indigo-700">
                    <span className="font-normal text-slate-400">#{r.id}</span> {r.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} short />
                    {(r.severity === 'critica' || r.severity === 'alta') && (
                      <span className={`text-xs font-semibold ${r.severity === 'critica' ? 'text-red-700' : 'text-orange-700'}`}>Gravedad {SEVERITY[r.severity].label.toLowerCase()}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {[r.category.name, !isOperativo && (r.area?.name ?? 'Sin área'), [r.calle, r.colonia].filter(Boolean).join(', '), `recibido ${timeAgo(r.createdAt)}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Link>
              <div className="flex flex-wrap gap-2 lg:shrink-0">
                <button onClick={() => setAction({ report: r, mode: 'status' })} className="btn-primary btn-compact">Actualizar estado</button>
                <button onClick={() => setAction({ report: r, mode: 'update' })} className="btn-secondary btn-compact">Agregar evidencia</button>
                {isAdmin && <button onClick={() => setAction({ report: r, mode: 'assign' })} className="btn-secondary btn-compact">{r.area ? 'Cambiar área' : 'Asignar área'}</button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {list.data && <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} onChange={setPage} />}

      {action && <AttentionDialog report={action.report} mode={action.mode} onClose={() => setAction(null)} />}
    </div>
  )
}
