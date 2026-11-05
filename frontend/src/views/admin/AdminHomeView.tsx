import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getAttentionReports, getAttentionSummary, getStaleReports } from '@/api/AttentionAPI'
import { useAuth } from '@/hooks/useAuth'
import { timeAgo } from '@/lib/date'
import { StatusBadge } from '@/components/ui/Badges'
import { ErrorState, ListSkeleton, Skeleton } from '@/components/ui/States'
import type { ReportStatus } from '@/types'

type Attention = { id: number; title: string; status: ReportStatus; createdAt: string; area: string | null; reasons: string[] }

/**
 * Resumen del administrador: solo lo necesario para el trabajo diario.
 * Las gráficas y el detalle viven en Estadísticas y en la Bandeja de atención.
 */
export default function AdminHomeView() {
  const { user } = useAuth()
  const summary = useQuery({ queryKey: ['attention', 'summary'], queryFn: getAttentionSummary })
  const unassigned = useQuery({ queryKey: ['attention', 'reports', { area: 'none', open: 'true', limit: 20 }], queryFn: () => getAttentionReports({ area: 'none', open: 'true', limit: 20 }) })
  const critical = useQuery({ queryKey: ['attention', 'reports', { severity: 'critica', open: 'true', limit: 20 }], queryFn: () => getAttentionReports({ severity: 'critica', open: 'true', limit: 20 }) })
  const stale = useQuery({ queryKey: ['attention', 'stale'], queryFn: () => getStaleReports() })

  const count = (...statuses: ReportStatus[]) =>
    summary.data?.byStatus.filter((s) => statuses.includes(s.status)).reduce((a, b) => a + b.total, 0) ?? 0

  // Una sola lista: cada reporte aparece una vez con todos sus motivos
  const attention = useMemo(() => {
    const map = new Map<number, Attention>()
    const add = (r: { id: number; title: string; status: ReportStatus; createdAt: string; area: { name: string } | null }, reason: string) => {
      const item = map.get(r.id) ?? { id: r.id, title: r.title, status: r.status, createdAt: r.createdAt, area: r.area?.name ?? null, reasons: [] }
      item.reasons.push(reason)
      map.set(r.id, item)
    }
    critical.data?.data.forEach((r) => add(r, 'Gravedad crítica'))
    unassigned.data?.data.forEach((r) => add(r, 'Sin área asignada'))
    stale.data?.reports.forEach((r) => add(r, `${r.daysWithoutMovement} días sin movimiento`))
    // Primero los que acumulan más motivos, luego los más antiguos
    return [...map.values()].sort((a, b) => b.reasons.length - a.reasons.length || +new Date(a.createdAt) - +new Date(b.createdAt))
  }, [critical.data, unassigned.data, stale.data])

  const listLoading = critical.isLoading || unassigned.isLoading || stale.isLoading
  const listError = critical.isError || unassigned.isError || stale.isError

  const kpis = [
    { label: 'Por atender', value: count('pendiente', 'en_revision'), hint: 'Recibidos o en validación', to: '/attention' },
    { label: 'En atención', value: count('asignado', 'en_proceso'), hint: 'Asignados o en proceso', to: '/attention' },
    { label: 'Resueltos', value: count('resuelto', 'cerrado'), hint: 'Total histórico', to: '/admin/stats' },
    { label: 'Requieren atención', value: listLoading ? null : attention.length, hint: 'Ver la lista de abajo', to: '#requieren', alert: true },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="page-title">Resumen</h1>
        <p className="page-subtitle">Hola, {user?.name?.split(' ')[0]}. Esto es lo que necesita tu atención hoy.</p>
      </header>

      {summary.isError ? (
        <ErrorState message="No pudimos cargar el resumen." onRetry={() => summary.refetch()} />
      ) : (
        <section className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-4" aria-label="Indicadores">
          {kpis.map((k, i) => {
            const className = `block p-5 transition hover:bg-slate-50 ${i % 2 ? 'border-l border-slate-200' : ''} ${i >= 2 ? 'border-t border-slate-200 lg:border-t-0' : ''} ${i > 0 ? 'lg:border-l' : ''}`
            const body = (
              <>
                <p className="text-sm text-slate-500">{k.label}</p>
                {summary.isLoading || k.value === null ? (
                  <Skeleton className="mt-2 h-8 w-14" />
                ) : (
                  <p className={`mt-1 text-3xl font-bold tabular-nums ${k.alert && k.value ? 'text-red-700' : 'text-slate-900'}`}>{k.value}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">{k.hint}</p>
              </>
            )
            return k.to.startsWith('#') ? (
              <a key={k.label} href={k.to} className={className}>{body}</a>
            ) : (
              <Link key={k.label} to={k.to} className={className}>{body}</Link>
            )
          })}
        </section>
      )}

      <section id="requieren" className="space-y-3" aria-labelledby="req-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="req-title" className="text-lg font-bold text-slate-900">Requieren atención</h2>
            <p className="text-sm text-slate-500">Reportes críticos, sin área asignada o sin movimiento reciente.</p>
          </div>
          <Link to="/attention" className="btn-secondary btn-compact">Abrir bandeja de atención</Link>
        </div>

        {listLoading ? (
          <ListSkeleton rows={4} />
        ) : listError ? (
          <ErrorState onRetry={() => { critical.refetch(); unassigned.refetch(); stale.refetch() }} />
        ) : attention.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Todo en orden: no hay reportes que requieran atención especial.</p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {attention.slice(0, 10).map((r) => (
              <li key={r.id}>
                <Link to={`/reports/${r.id}`} className="flex flex-col gap-1.5 p-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900"><span className="font-normal text-slate-400">#{r.id}</span> {r.title}</p>
                    <p className="text-xs text-slate-500">{r.area ? `${r.area} · ` : ''}recibido {timeAgo(r.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.reasons.map((reason) => (
                      <span key={reason} className={`rounded px-2 py-0.5 text-xs font-medium ${reason === 'Gravedad crítica' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{reason}</span>
                    ))}
                    <StatusBadge status={r.status} short />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {attention.length > 10 && <p className="text-sm text-slate-500">Y {attention.length - 10} más en la bandeja de atención.</p>}
      </section>
    </div>
  )
}
