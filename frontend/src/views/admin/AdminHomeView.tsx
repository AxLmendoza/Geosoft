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
import { ArrowRightIcon, CheckBadgeIcon, ClockIcon, ExclamationTriangleIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { Stagger, StaggerItem } from '@/components/ui/Motion'

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

  const kpis = [
    { label: 'Por atender', value: count('pendiente', 'en_revision'), hint: 'Recibidos o en validación', to: '/attention', icon: ClockIcon, tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
    { label: 'En atención', value: count('asignado', 'en_proceso'), hint: 'Asignados o en proceso', to: '/attention', icon: WrenchScrewdriverIcon, tone: 'bg-brand-50 text-brand-700 ring-brand-200' },
    { label: 'Resueltos', value: count('resuelto', 'cerrado'), hint: 'Total histórico', to: '/admin/stats', icon: CheckBadgeIcon, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    { label: 'Requieren atención', value: listLoading ? null : attention.length, hint: 'Ver la lista de abajo', to: '#requieren', alert: true, icon: ExclamationTriangleIcon, tone: 'bg-red-50 text-red-700 ring-red-200' },
  ]

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Panel de administración</p>
        <h1 className="page-title mt-1">Resumen</h1>
        <p className="page-subtitle">Hola, {user?.name?.split(' ')[0]}. Esto es lo que necesita tu atención hoy.</p>
      </header>

      {summary.isError ? (
        <ErrorState message="No pudimos cargar el resumen." onRetry={() => summary.refetch()} />
      ) : (
        <section aria-label="Indicadores">
          <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {kpis.map((k) => {
              const className = 'glass group flex h-full flex-col rounded-2xl p-4 transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift sm:p-5'
              const body = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <span className={`flex size-10 items-center justify-center rounded-xl ring-1 ring-inset ${k.tone}`}>
                      <k.icon className="size-5" aria-hidden />
                    </span>
                    <ArrowRightIcon className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden />
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-600">{k.label}</p>
                  {summary.isLoading || k.value === null ? (
                    <Skeleton className="mt-1.5 h-9 w-16" />
                  ) : (
                    <p className={`mt-0.5 font-display text-3xl font-semibold tracking-tight tabular-nums ${k.alert && k.value ? 'text-red-700' : 'text-slate-900'}`}>{k.value}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">{k.hint}</p>
                </>
              )
              return (
                <StaggerItem key={k.label}>
                  {k.to.startsWith('#') ? (
                    <a href={k.to} className={className}>{body}</a>
                  ) : (
                    <Link to={k.to} className={className}>{body}</Link>
                  )}
                </StaggerItem>
              )
            })}
          </Stagger>
        </section>
      )}

      {team && (
        <section aria-labelledby="team-title" className="glass rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="team-title" className="font-display text-lg font-semibold text-slate-900">Equipo responsable</h2>
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
                <li key={a.id} className="flex gap-2.5 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-950 ring-1 ring-inset ring-red-200">
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
            <h2 id="req-title" className="font-display text-lg font-semibold text-slate-900">Requieren atención</h2>
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
                <Link to={`/reports/${r.id}`} className="flex flex-col gap-1.5 p-4 transition-colors hover:bg-brand-50/40 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900"><span className="font-normal text-slate-400">#{r.id}</span> {r.title}</p>
                    <p className="text-xs text-slate-500">{r.area ? `${r.area} · ` : ''}recibido {timeAgo(r.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.reasons.map((reason) => (
                      <span key={reason} className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${reason === 'Gravedad crítica' ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-slate-50 text-slate-700 ring-slate-200'}`}>{reason}</span>
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
