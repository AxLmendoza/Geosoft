import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { getReports } from '@/api/ReportAPI'
import { useCategories } from '@/hooks/useCategories'
import { STATUS_OPTIONS } from '@/lib/labels'
import ReportMap from '@/components/map/ReportMap'
import ReportCard from '@/components/reports/ReportCard'
import { ReportCardSkeleton } from '@/components/ui/States'
import SelectBox from '@/components/ui/SelectBox'
import { PIN_LEGEND, PinStatusIcon } from '@/components/map/pinIcons'
import type { ReportFilters, ReportStatus } from '@/types'

/** Panel flotante sobre el mapa (filtros / recientes) */
function MapPanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <aside className="glass-strong absolute inset-x-2 bottom-2 top-2 z-30 flex flex-col rounded-xl md:inset-x-auto md:bottom-3 md:left-3 md:top-3 md:w-96">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <button onClick={onClose} className="btn-secondary btn-compact">
          <XMarkIcon className="size-4" aria-hidden /> Cerrar
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  )
}

export default function MapView() {
  const [params, setParams] = useSearchParams()
  const category = Number(params.get('category')) || 0
  const status = (params.get('status') ?? '') as ReportStatus | ''
  const panel = params.get('panel')
  const { data: categories = [] } = useCategories()

  const setParam = (key: string, value: string | number | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, String(value))
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  const filters: ReportFilters = { category: category || undefined, status: status || undefined }
  const { data: reports = [], isLoading, isError } = useQuery({
    queryKey: ['reports', filters],
    queryFn: () => getReports(filters),
    refetchInterval: 60_000,
  })

  const categoryOptions = useMemo(
    () => [{ value: 0, label: 'Todas' }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
    [categories],
  )

  const count = isLoading ? 'Cargando…' : `${reports.length} reporte${reports.length === 1 ? '' : 's'}`
  const activeFilters = (category ? 1 : 0) + (status ? 1 : 0)

  return (
    <>
      <ReportMap reports={reports} fullscreen />

      {/* Acciones del mapa, con texto para que se entienda qué hace cada una */}
      {!panel && (
        <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
          <button onClick={() => setParam('panel', 'filtros')} className="glass-btn !px-3 !py-2 !text-sm">
            <FunnelIcon className="size-4" aria-hidden /> Filtros{activeFilters ? ` (${activeFilters})` : ''}
          </button>
          <button onClick={() => setParam('panel', 'recientes')} className="glass-btn !px-3 !py-2 !text-sm">
            Ver lista
          </button>
          <span className="glass-btn !text-xs" aria-live="polite">{count}</span>
        </div>
      )}

      {panel === 'filtros' && (
        <MapPanel title="Filtrar reportes" onClose={() => setParam('panel', null)}>
          <div className="space-y-4">
            <SelectBox label="Categoría" value={category} onChange={(v) => setParam('category', v)} options={categoryOptions} />
            <SelectBox
              label="Estado"
              value={status}
              onChange={(v) => setParam('status', v)}
              options={[{ value: '' as const, label: 'Todos' }, ...STATUS_OPTIONS]}
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">{count}</p>
              {activeFilters > 0 && (
                <button onClick={() => setParams((prev) => { const n = new URLSearchParams(prev); n.delete('category'); n.delete('status'); return n }, { replace: true })} className="btn-link">
                  Quitar filtros
                </button>
              )}
            </div>
            {isError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">No se pudieron cargar los reportes. Se reintentará automáticamente.</p>}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Significado de los pines</p>
              <ul className="space-y-1.5">
                {PIN_LEGEND.map((p) => (
                  <li key={p.kind} className="flex items-center gap-2 text-sm text-slate-700">
                    <PinStatusIcon kind={p.kind} className="size-4" /> {p.label}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </MapPanel>
      )}

      {panel === 'recientes' && (
        <MapPanel title="Reportes recientes" onClose={() => setParam('panel', null)}>
          <p className="mb-3 text-sm text-slate-600">{count}</p>
          {isLoading ? (
            <div className="grid gap-4">{Array.from({ length: 3 }).map((_, i) => <ReportCardSkeleton key={i} />)}</div>
          ) : reports.length === 0 ? (
            <p className="text-center text-slate-500">No hay reportes con estos filtros.</p>
          ) : (
            <div className="grid gap-4">
              {reports.slice(0, 9).map((r) => (
                <ReportCard key={r.id} report={r} />
              ))}
            </div>
          )}
        </MapPanel>
      )}
    </>
  )
}
