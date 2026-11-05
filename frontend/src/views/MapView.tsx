import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ClockIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { getReports } from '@/api/ReportAPI'
import { useCategories } from '@/hooks/useCategories'
import { STATUS_OPTIONS } from '@/lib/labels'
import ReportMap from '@/components/map/ReportMap'
import ReportCard from '@/components/reports/ReportCard'
import { ReportCardSkeleton } from '@/components/ui/States'
import SelectBox from '@/components/ui/SelectBox'
import CategoryIcon from '@/components/CategoryIcon'
import { PIN_LEGEND, PinStatusIcon } from '@/components/map/pinIcons'
import type { ReportFilters, ReportStatus } from '@/types'

/** Panel de cristal que se abre junto a la barra lateral, encima del mapa */
function MapPanel({ title, icon, onClose, children }: { title: string; icon: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <aside className="glass-strong absolute inset-x-2 bottom-2 top-2 z-30 flex flex-col rounded-3xl md:inset-x-auto md:bottom-3 md:left-[5.75rem] md:top-3 md:w-[calc(100vw-7rem)] md:max-w-sm">
      <header className="flex items-center justify-between gap-2 border-b border-white/50 px-5 py-4">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
          {icon} {title}
        </h2>
        <button onClick={onClose} aria-label="Cerrar panel" className="rounded-lg p-1 text-slate-500 hover:bg-white/60 hover:text-slate-800">
          <XMarkIcon className="size-6" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
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

      {/* En el celular no hay barra lateral: acceso directo a los filtros sobre el mapa */}
      {!panel && (
        <div className="absolute left-2 top-[5.5rem] z-20 flex flex-col gap-2 md:hidden">
          <button onClick={() => setParam('panel', 'filtros')} className="glass-btn !px-3 !py-2 !text-sm">
            <FunnelIcon className="size-5" /> Filtros{activeFilters ? ` · ${activeFilters}` : ''}
          </button>
          <span className="glass-btn !text-xs" aria-live="polite">{isLoading ? <span className="size-3 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /> : null}{count}</span>
        </div>
      )}

      {panel === 'filtros' && (
        <MapPanel title="Filtrar reportes" icon={<FunnelIcon className="size-5" />} onClose={() => setParam('panel', null)}>
          <div className="space-y-4">
            <SelectBox label="Categoría" value={category} onChange={(v) => setParam('category', v)} options={categoryOptions} />
            <SelectBox
              label="Estado"
              value={status}
              onChange={(v) => setParam('status', v)}
              options={[{ value: '' as const, label: 'Todos' }, ...STATUS_OPTIONS]}
            />
            <p className="text-sm font-semibold text-slate-600">{count}</p>
            {isError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">No se pudieron cargar los reportes. Se reintentará automáticamente.</p>}

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Significado de los pines</p>
              <ul className="flex flex-wrap gap-2">
                {PIN_LEGEND.map((p) => (
                  <li key={p.kind} className="inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-white/70">
                    <PinStatusIcon kind={p.kind} className="size-4" /> {p.label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Leyenda de categorías */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Categorías</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setParam('category', category === c.id ? null : c.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 transition ${
                      category === c.id ? 'text-white ring-transparent' : 'bg-white/60 text-slate-700 ring-white/70 hover:bg-white/80'
                    }`}
                    style={category === c.id ? { backgroundColor: c.color } : undefined}
                  >
                    <span style={{ color: category === c.id ? '#fff' : c.color }}>
                      <CategoryIcon slug={c.slug} className="size-4" />
                    </span>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </MapPanel>
      )}

      {panel === 'recientes' && (
        <MapPanel title="Reportes recientes" icon={<ClockIcon className="size-5" />} onClose={() => setParam('panel', null)}>
          <p className="mb-3 text-sm font-semibold text-slate-600">{count}</p>
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
