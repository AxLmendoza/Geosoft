import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getAdminAreas, getAttentionReports, getAttentionSummary, getStaleReports } from '@/api/AttentionAPI'
import { getStaff } from '@/api/StaffAPI'
import { useAuth } from '@/hooks/useAuth'
import { timeAgo } from '@/lib/date'
import { StatusBadge } from '@/components/ui/Badges'
import { ErrorState, ListSkeleton, Skeleton } from '@/components/ui/States'
import type { ReportStatus } from '@/types'
import { ChevronRightIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

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
  const staff = useQuery({ queryKey: ['staff', { role: 'operativo' }], queryFn: () => getStaff({ role: 'operativo' }) })
  const areas = useQuery({ queryKey: ['admin-areas'], queryFn: getAdminAreas, staleTime: 5 * 60_000 })

  // Equipo: invitaciones sin aceptar y áreas con reportes abiertos que nadie puede atender
  const team = useMemo(() => {
    if (!staff.data || !areas.data) return null
    const active = staff.data.filter((m) => m.status === 'activo')
    const pending = staff.data.filter((m) => m.status === 'invitacion_pendiente' || m.status === 'invitacion_vencida')
    const uncovered = areas.data.filter((a) => a.active && a.type !== 'externa' && (a.openReports ?? 0) > 0 && !active.some((m) => m.area?.id === a.id))
    return { active: active.length, pending: pending.length, uncovered }
  }, [staff.data, areas.data])

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

  // Indicadores: la cifra es la protagonista; el punto de color + texto dicen la etapa (no solo el color)
  const kpis = [
    { label: 'Requieren atención', value: listLoading ? null : attention.length, hint: 'Críticos, sin área o detenidos', to: '#requieren', alert: true, dot: 'bg-red-600' },
    { label: 'Por atender', value: count('pendiente', 'en_revision'), hint: 'Recibidos o en validación', to: '/attention', dot: 'bg-amber-500' },
    { label: 'En atención', value: count('asignado', 'en_proceso'), hint: 'Asignados o en proceso', to: '/attention', dot: 'bg-brand-600' },
    { label: 'Resueltos', value: count('resuelto', 'cerrado'), hint: 'Total histórico', to: '/admin/stats', dot: 'bg-emerald-600' },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="page-title">Resumen municipal</h1>
        <p className="page-subtitle">Hola, {user?.name?.split(' ')[0]}. Esto es lo que necesita tu atención hoy.</p>
      </header>

      {summary.isError ? (
        <ErrorState message="No pudimos cargar el resumen." onRetry={() => summary.refetch()} />
      ) : (
        <section aria-label="Indicadores" className="glass overflow-hidden rounded-2xl">
          <ul className="grid grid-cols-2 lg:grid-cols-4">
            {kpis.map((k, i) => {
              const body = (
                <>
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <span className={`size-2 shrink-0 rounded-full ${k.dot}`} aria-hidden />
                    {k.label}
                  </span>
                  {summary.isLoading || k.value === null ? (
                    <Skeleton className="mt-3 h-11 w-20" />
                  ) : (
                    <span className={`figure mt-2 block text-[2.5rem] leading-[2.75rem] sm:text-5xl sm:leading-[3.25rem] ${k.alert && k.value ? 'text-red-700!' : ''}`}>{k.value}</span>
                  )}
                  <span className="mt-1 flex items-center justify-between gap-2 text-[13px] text-slate-500">
                    {k.hint}
                    <ChevronRightIcon className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden />
                  </span>
                </>
              )
              const className = 'group block h-full p-5 transition-colors hover:bg-surface-sunken sm:p-6'
              // Filetes entre celdas: verticales dentro de la fila, horizontal entre filas cuando hay 2 columnas
              const borders = `border-line ${i % 2 ? 'border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`
              return (
                <li key={k.label} className={borders}>
                  {k.to.startsWith('#') ? (
                    <a href={k.to} className={className}>{body}</a>
                  ) : (
                    <Link to={k.to} className={className}>{body}</Link>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {team && (
        <section aria-labelledby="team-title" className="card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="team-title" className="font-display text-xl font-semibold text-slate-900">Equipo responsable</h2>
              <p className="text-sm text-slate-600">
                {team.active} {team.active === 1 ? 'persona activa' : 'personas activas'} en las áreas
                {team.pending > 0 && <>, {team.pending} {team.pending === 1 ? 'invitación sin aceptar' : 'invitaciones sin aceptar'}</>}.
              </p>
            </div>
            <Link to="/admin/staff" className="btn-secondary btn-compact">Ver responsables</Link>
          </div>
          {team.uncovered.length > 0 && (
            <ul className="mt-4 space-y-2">
              {team.uncovered.map((a) => (
                <li key={a.id} className="flex gap-2.5 rounded-xl bg-red-50/70 px-3.5 py-2.5 text-sm text-red-950 ring-1 ring-inset ring-red-100">
                  <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
                  <span>
                    <b className="font-semibold">{a.name}</b> tiene {a.openReports} {a.openReports === 1 ? 'reporte abierto' : 'reportes abiertos'} y nadie activo para atenderlos.{' '}
                    <Link to="/admin/staff/new" className="font-semibold underline">Registrar responsable</Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section id="requieren" className="space-y-3" aria-labelledby="req-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="req-title" className="font-display text-xl font-semibold text-slate-900">Requieren atención</h2>
            <p className="text-sm text-slate-500">Reportes críticos, sin área asignada o sin movimiento reciente.</p>
          </div>
          <Link to="/attention" className="btn-secondary btn-compact">Abrir bandeja de atención</Link>
        </div>

        {listLoading ? (
          <ListSkeleton rows={4} />
        ) : listError ? (
          <ErrorState onRetry={() => { critical.refetch(); unassigned.refetch(); stale.refetch() }} />
        ) : attention.length === 0 ? (
          <p className="glass rounded-2xl p-8 text-center text-sm text-slate-500">Todo en orden: no hay reportes que requieran atención especial.</p>
        ) : (
          <ul className="glass divide-y divide-line overflow-hidden rounded-2xl">
            {attention.slice(0, 10).map((r) => (
              <li key={r.id}>
                <Link to={`/reports/${r.id}`} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-sunken sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      {r.reasons.includes('Gravedad crítica') && (
                        <span className="size-3 shrink-0 rotate-45 rounded-[2px] bg-red-600" aria-hidden />
                      )}
                      <span className="line-clamp-2 min-w-0 font-semibold text-slate-900 sm:line-clamp-1">
                        {r.reasons.includes('Gravedad crítica') && <span className="sr-only">Gravedad crítica: </span>}
                        <span className="font-normal text-slate-400">#{r.id}</span> {r.title}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {[...r.reasons.filter((x) => x !== 'Gravedad crítica'), r.area, `recibido ${timeAgo(r.createdAt)}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <StatusBadge status={r.status} short />
                  <ChevronRightIcon className="hidden size-4 shrink-0 text-slate-300 transition group-hover:text-brand-600 sm:block" aria-hidden />
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
