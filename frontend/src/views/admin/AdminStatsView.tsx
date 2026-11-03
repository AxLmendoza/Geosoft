import { useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { format, startOfYear, subDays, subMonths } from 'date-fns'
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import { downloadStatsPdf, getStats, type StatsRange } from '@/api/ModerationAPI'
import { formatShortDate } from '@/lib/date'
import StatTile from '@/components/admin/StatTile'
import { CategoryChart, MonthlyChart, SeverityChart, StatusChart } from '@/components/admin/Charts'

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
  const { data: stats, isLoading } = useQuery({ queryKey: ['admin-stats', range], queryFn: () => getStats(range) })

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
          <h1 className="text-3xl font-extrabold text-slate-900">Estadísticas</h1>
          <p className="text-slate-500">
            {stats ? `${formatShortDate(stats.range.from)} – ${formatShortDate(stats.range.to)}` : 'Cargando…'} · incluye reportes eliminados
          </p>
        </div>
        <button onClick={() => pdf.mutate(range)} disabled={pdf.isPending} className="btn-primary">
          <DocumentArrowDownIcon className="size-5" /> {pdf.isPending ? 'Generando PDF…' : 'Descargar PDF'}
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

      {isLoading || !stats || !t ? (
        <p className="py-16 text-center text-slate-500">Cargando estadísticas…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Reportes" value={t.total} hint={`${t.eliminados} eliminados · ${t.ocultos} ocultos`} />
            <StatTile label="Resueltos" value={t.resueltos} hint={`${(t.tasaResolucion * 100).toFixed(1)}% de resolución`} />
            <StatTile label="Abiertos" value={t.abiertos} hint={`${t.rechazados} rechazados`} />
            <StatTile label="Tiempo de solución" value={fmtHours(t.promedioHorasSolucion)} hint="Promedio desde que se reporta" />
            <StatTile label="Votos de la comunidad" value={t.votos} />
            <StatTile label="Usuarios" value={t.usuarios} hint={`${t.moderadores} moderadores`} />
            <StatTile label="Baneados" value={t.baneados} />
            <StatTile label="Denuncias pendientes" value={t.denunciasPendientes} />
          </div>

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
        </>
      )}
    </div>
  )
}
