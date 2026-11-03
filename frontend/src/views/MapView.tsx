import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ClockIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { getReports } from '@/api/ReportAPI'
import { useCategories } from '@/hooks/useCategories'
import { STATUS_OPTIONS } from '@/lib/labels'
import ReportMap from '@/components/map/ReportMap'
import ReportCard from '@/components/reports/ReportCard'
import SelectBox from '@/components/ui/SelectBox'
import CategoryIcon from '@/components/CategoryIcon'
import { PIN_LEGEND, PinStatusIcon } from '@/components/map/pinIcons'
import type { ReportFilters, ReportStatus } from '@/types'

/** Panel de cristal que se abre junto a la barra lateral, encima del mapa */
function MapPanel({ title, icon, onClose, children }: { title: string; icon: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <aside className="glass absolute bottom-2 left-[4.5rem] top-2 z-30 flex w-[calc(100vw-5.25rem)] max-w-sm flex-col rounded-3xl md:bottom-3 md:left-[5.75rem] md:top-3">
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
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports', filters],
    queryFn: () => getReports(filters),
    refetchInterval: 60_000,
  })

  const categoryOptions = useMemo(
    () => [{ value: 0, label: 'Todas' }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
    [categories],
  )

  const count = isLoading ? 'Cargando…' : `${reports.length} reporte${reports.length === 1 ? '' : 's'}`

  return (
    <>
      <ReportMap reports={reports} fullscreen />

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
          {reports.length === 0 && !isLoading ? (
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
