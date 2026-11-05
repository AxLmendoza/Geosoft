import { useState, type ReactNode } from 'react'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { format, startOfYear, subDays, subMonths } from 'date-fns'
import { downloadStatsPdf, getStats, type StatsRange } from '@/api/ModerationAPI'
import { formatShortDate } from '@/lib/date'
import StatTile from '@/components/admin/StatTile'
import { CategoryChart, MonthlyChart, SeverityChart, StatusChart } from '@/components/admin/Charts'
import { ErrorState, RefreshingBadge, Skeleton } from '@/components/ui/States'
import { AREA_TYPE } from '@/lib/labels'

/** Misma forma que el tablero real: evita la pantalla vacía y el "salto" al cargar */
function StatsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando estadísticas">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-2xl glass p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="card space-y-3">
        <Skeleton className="h-5 w-56" />
        <div className="flex h-[240px] items-end gap-2 pt-4">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="flex-1" style={{ height: `${30 + ((i * 37) % 60)}%` }} />)}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <span className="sr-only">Cargando estadísticas…</span>
    </div>
  )
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const today = () => new Date()

const PRESETS = [
  { label: '30 días', range: () => ({ from: iso(subDays(today(), 30)), to: iso(today()) }) },
  { label: '3 meses', range: () => ({ from: iso(subMonths(today(), 3)), to: iso(today()) }) },
  { label: '12 meses', range: () => ({ from: iso(subMonths(today(), 11)), to: iso(today()) }) },
  { label: 'Este año', range: () => ({ from: iso(startOfYear(today())), to: iso(today()) }) },
]

const fmtHours = (h: number | null) => (h === null ? '—' : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} días`)

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
      {subtitle && <p className="mb-3 text-sm text-slate-500">{subtitle}</p>}
      {children}
    </section>
  )
}

export default function AdminStatsView() {
  const [range, setRange] = useState<StatsRange>(PRESETS[2].range())
  const { data: stats, isLoading, isError, isFetching, isPlaceholderData, refetch } = useQuery({
    queryKey: ['admin-stats', range],
    queryFn: () => getStats(range),
    placeholderData: keepPreviousData, // al cambiar el rango se conservan los datos anteriores mientras llega lo nuevo
  })

  const pdf = useMutation({
    mutationFn: downloadStatsPdf,
    onError: (e) => toast.error(e.message),
    onSuccess: () => toast.success('Informe descargado'),
  })

  const t = stats?.totals

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">Estadísticas <RefreshingBadge show={isFetching && !isLoading} /></h1>
          <p className="text-slate-500">
            {stats ? `${formatShortDate(stats.range.from)} – ${formatShortDate(stats.range.to)}` : 'Cargando…'} · incluye reportes eliminados
          </p>
        </div>
        <button onClick={() => pdf.mutate(range)} disabled={pdf.isPending} className="btn-primary">
          {pdf.isPending ? 'Generando informe…' : 'Descargar informe PDF'}
        </button>
      </header>

      {/* Filtros en una sola fila */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl glass p-4">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {PRESETS.map((p) => {
            const r = p.range()
            const active = r.from === range.from && r.to === range.to
            return (
              <button
                key={p.label}
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${active ? 'bg-white text-indigo-700 shadow' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <label className="text-sm">
          <span className="label">Desde</span>
          <input type="date" className="input py-1.5" value={range.from ?? ''} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        </label>
        <label className="text-sm">
          <span className="label">Hasta</span>
          <input type="date" className="input py-1.5" value={range.to ?? ''} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        </label>
      </div>

      {isLoading ? (
        <StatsSkeleton />
      ) : isError || !stats || !t ? (
        <ErrorState message="No pudimos cargar las estadísticas." onRetry={() => refetch()} />
      ) : t.total === 0 ? (
        <div className="rounded-2xl glass p-10 text-center">
          <p className="font-bold text-slate-800">No hay reportes en este periodo</p>
          <p className="text-sm text-slate-500">Prueba con un rango de fechas más amplio.</p>
        </div>
      ) : (
        <div className={`space-y-6 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Reportes recibidos" value={t.total} />
            <StatTile label="Abiertos" value={t.abiertos} />
            <StatTile label="Resueltos" value={t.resueltos} hint={`${(t.tasaResolucion * 100).toFixed(0)}% del total`} />
            <StatTile label="Tiempo promedio de solución" value={fmtHours(t.promedioHorasSolucion)} />
          </div>
          <p className="-mt-2 text-sm text-slate-500">
            {t.rechazados} no procedentes · {t.ocultos} ocultos · {t.eliminados} eliminados · {t.votos} votos de vecinos · {t.usuarios} usuarios ({t.operativos ?? 0} operativos, {t.moderadores} moderadores, {t.baneados} suspendidos) · {t.denunciasPendientes} denuncias pendientes
          </p>

          <Panel title="Reportados vs. resueltos por mes" subtitle="Reportes creados en el mes y los que se marcaron como resueltos en ese mes">
            <MonthlyChart data={stats.monthly} />
          </Panel>

          <Panel title="Reportes por categoría" subtitle="Abiertos, resueltos y rechazados por tipo de problema">
            {stats.byCategory.length ? <CategoryChart data={stats.byCategory} /> : <p className="text-sm text-slate-500">Sin datos en el periodo.</p>}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Por estado">
              <StatusChart data={stats.byStatus} />
            </Panel>
            <Panel title="Por gravedad">
              <SeverityChart data={stats.bySeverity} />
            </Panel>
          </div>

          <Panel title="Carga por área responsable" subtitle="Reportes abiertos, resueltos y tiempo promedio de solución de cada área o dependencia">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Área</th>
                    <th className="py-2 text-right">Total</th>
                    <th className="py-2 text-right">Abiertos</th>
                    <th className="py-2 text-right">Resueltos</th>
                    <th className="py-2 text-right">Prom. solución</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.byArea.map((a) => (
                    <tr key={a.id ?? 'none'}>
                      <td className="py-2">
                        <span className={`font-semibold ${a.id ? 'text-slate-900' : 'text-amber-700'}`}>{a.name}</span>
                        {a.type && <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${AREA_TYPE[a.type].className}`}>{AREA_TYPE[a.type].label}</span>}
                      </td>
                      <td className="py-2 text-right tabular-nums">{a.total}</td>
                      <td className="py-2 text-right font-bold tabular-nums">{a.abiertos}</td>
                      <td className="py-2 text-right tabular-nums">{a.resueltos}</td>
                      <td className="py-2 text-right tabular-nums">{fmtHours(a.promedioHorasSolucion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Zonas prioritarias" subtitle="Índice = suma de la gravedad de los reportes abiertos (baja 1 · media 2 · alta 3 · crítica 5)">
            {stats.priorityZones.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2">#</th>
                      <th className="py-2">Colonia</th>
                      <th className="py-2 text-right">Abiertos</th>
                      <th className="py-2 text-right">Críticos</th>
                      <th className="py-2 text-right">Índice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.priorityZones.map((z, i) => (
                      <tr key={z.colonia}>
                        <td className="py-2 text-slate-500">{i + 1}</td>
                        <td className="py-2 font-semibold text-slate-900">{z.colonia}</td>
                        <td className="py-2 text-right tabular-nums">{z.abiertos}</td>
                        <td className="py-2 text-right tabular-nums">{z.criticos}</td>
                        <td className="py-2 text-right font-bold tabular-nums">{z.indice}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No hay reportes abiertos en el periodo.</p>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
