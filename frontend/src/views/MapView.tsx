import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { FunnelIcon, InformationCircleIcon, ListBulletIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { getReports } from '@/api/ReportAPI'
import { useCategories } from '@/hooks/useCategories'
import { STATUS_OPTIONS } from '@/lib/labels'
import ReportMap from '@/components/map/ReportMap'
import ReportCard from '@/components/reports/ReportCard'
import { ReportCardSkeleton } from '@/components/ui/States'
import SelectBox from '@/components/ui/SelectBox'
import MapLegend from '@/components/map/MapLegend'
import type { ReportFilters, ReportStatus } from '@/types'
import { m, Stagger, StaggerItem } from '@/components/ui/Motion'

/** Panel flotante sobre el mapa (filtros / recientes) */
function MapPanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <m.aside
      initial={{ opacity: 0, x: -16, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="glass-strong absolute inset-x-2 bottom-2 top-2 z-30 flex flex-col overflow-hidden rounded-2xl bg-white/95 backdrop-blur-xl md:inset-x-auto md:bottom-4 md:left-4 md:top-4 md:w-[24rem]"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <h2 className="font-display text-base font-semibold text-slate-900">{title}</h2>
        <button onClick={onClose} className="btn-secondary btn-compact">
          <XMarkIcon className="size-4" aria-hidden /> Cerrar
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </m.aside>
  )
}

const LEGEND_KEY = 'gs-map-legend'

/** Simbología abierta por defecto en escritorio y cerrada en celular; se recuerda la preferencia */
function useLegendOpen() {
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(LEGEND_KEY)
      if (saved !== null) return saved === '1'
    } catch {
      /* almacenamiento no disponible */
    }
    return window.matchMedia('(min-width: 768px)').matches
  })
  const toggle = () =>
    setOpen((v) => {
      try {
        localStorage.setItem(LEGEND_KEY, v ? '0' : '1')
      } catch {
        /* sin almacenamiento: solo dura la sesión */
      }
      return !v
    })
  return [open, toggle] as const
}

export default function MapView() {
  const [legendOpen, toggleLegend] = useLegendOpen()
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
        <m.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-3 right-14 top-3 z-20 flex flex-col items-start gap-2 md:left-4 md:right-auto"
          style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setParam('panel', 'filtros')} className="glass-btn !px-3 !py-2 !text-sm">
            <FunnelIcon className="size-4" aria-hidden /> Filtros{activeFilters ? ` (${activeFilters})` : ''}
          </button>
          <button onClick={() => setParam('panel', 'recientes')} className="glass-btn !px-3 !py-2 !text-sm">
            <ListBulletIcon className="size-4" aria-hidden /> Ver lista
          </button>
          <button onClick={toggleLegend} className="glass-btn !px-3 !py-2 !text-sm" aria-expanded={legendOpen} aria-controls="map-legend">
            <InformationCircleIcon className="size-4" aria-hidden /> Simbología
          </button>
          <span className="glass-btn pointer-events-none !text-xs" aria-live="polite">{count}</span>
          </div>
          {legendOpen && (
            <div id="map-legend" className="glass-strong w-[17rem] max-w-full rounded-2xl bg-white/95 p-3.5 backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Simbología</p>
                <button onClick={toggleLegend} className="inline-flex size-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Ocultar simbología">
                  <XMarkIcon className="size-4" aria-hidden />
                </button>
              </div>
              <MapLegend />
            </div>
          )}
        </m.div>
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
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Simbología del mapa</p>
              <MapLegend className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-line" />
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
            <Stagger className="grid gap-4">
              {reports.slice(0, 9).map((r) => (
                <StaggerItem key={r.id}>
                  <ReportCard report={r} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </MapPanel>
      )}
    </>
  )
}
