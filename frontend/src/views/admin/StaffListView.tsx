import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronRightIcon, MagnifyingGlassIcon, UserPlusIcon } from '@heroicons/react/20/solid'
import { getStaff, getStaffMeta, type StaffStatusFilter } from '@/api/StaffAPI'
import { getAdminAreas } from '@/api/AttentionAPI'
import { ROLE } from '@/lib/labels'
import { formatShortDate } from '@/lib/date'
import SelectBox from '@/components/ui/SelectBox'
import { AccountStatusBadge } from '@/components/ui/Badges'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States'
import MailNotice from '@/components/staff/MailNotice'

const STATUS_OPTIONS: { value: StaffStatusFilter; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'activo', label: 'Activas' },
  { value: 'pendiente', label: 'Invitación pendiente' },
  { value: 'desactivado', label: 'Desactivadas' },
  { value: 'suspendido', label: 'Suspendidas' },
]

/** Responsables: el personal que atiende y modera, con su área y su carga de trabajo */
export default function StaffListView() {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [areaId, setAreaId] = useState(0)
  const [status, setStatus] = useState<StaffStatusFilter>('')

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const filters = { q: q || undefined, areaId: areaId || undefined, status }
  const list = useQuery({ queryKey: ['staff', filters], queryFn: () => getStaff(filters), placeholderData: keepPreviousData })
  const meta = useQuery({ queryKey: ['staff', 'meta'], queryFn: getStaffMeta, staleTime: 5 * 60_000 })
  const areas = useQuery({ queryKey: ['admin-areas'], queryFn: getAdminAreas, staleTime: 5 * 60_000 })

  const areaOptions = useMemo(
    () => [{ value: 0, label: 'Todas las áreas' }, ...(areas.data ?? []).filter((a) => a.type !== 'externa').map((a) => ({ value: a.id, label: a.name }))],
    [areas.data],
  )
  const filtered = !!(q || areaId || status)
  const members = list.data ?? []

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Responsables</h1>
          <p className="page-subtitle">Personal que atiende los reportes de cada área y modera el contenido.</p>
        </div>
        <Link to="/admin/staff/new" className="btn-primary">
          <UserPlusIcon className="size-5" aria-hidden /> Registrar responsable
        </Link>
      </header>

      <MailNotice meta={meta.data} />

      <section aria-label="Filtros" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_12rem]">
        <label className="relative block">
          <span className="sr-only">Buscar por nombre o correo</span>
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o correo" className="input pl-11" />
        </label>
        <SelectBox value={areaId} onChange={setAreaId} options={areaOptions} />
        <SelectBox value={status} onChange={setStatus} options={STATUS_OPTIONS} />
      </section>

      {list.isLoading ? (
        <ListSkeleton rows={5} />
      ) : list.isError ? (
        <ErrorState message="No pudimos cargar a los responsables." onRetry={() => list.refetch()} />
      ) : members.length === 0 ? (
        <EmptyState
          title={filtered ? 'Nadie coincide con estos filtros' : 'Aún no hay responsables'}
          text={filtered ? 'Cambia la búsqueda o el estado para ver a más personas.' : 'Registra a la primera persona que atenderá los reportes de un área.'}
          action={!filtered && <Link to="/admin/staff/new" className="btn-primary">Registrar responsable</Link>}
        />
      ) : (
        <div className={`glass overflow-hidden rounded-2xl transition-opacity ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
          <div
            className="hidden border-b border-line bg-slate-50 px-5 py-2.5 text-xs font-semibold text-slate-500 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_10rem_6rem_6.5rem_1.25rem] md:gap-4"
            aria-hidden
          >
            <span>Persona</span>
            <span>Área y rol</span>
            <span>Cuenta</span>
            <span className="text-right">Abiertos</span>
            <span>Modificado</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/admin/staff/${m.id}`}
                  className={`group grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 px-5 py-4 transition-colors hover:bg-brand-50/50 focus-visible:bg-brand-50/50 md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_10rem_6rem_6.5rem_1.25rem] md:items-center md:gap-4 ${m.active ? '' : 'bg-slate-50/70'}`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate font-semibold ${m.active ? 'text-slate-900' : 'text-slate-500'}`}>
                      {m.name}
                      {m.isSelf && <span className="ml-1.5 text-xs font-medium text-slate-500">(tú)</span>}
                    </span>
                    <span className="block truncate text-sm text-slate-500">{m.email}</span>
                  </span>
                  <ChevronRightIcon className="size-5 self-center text-slate-300 group-hover:text-brand-600 md:order-last" aria-hidden />
                  <span className="col-span-2 min-w-0 text-sm md:col-span-1">
                    <span className="block truncate text-slate-800">{m.area?.name ?? (m.role === 'operativo' ? 'Sin área asignada' : 'Toda la plataforma')}</span>
                    <span className="block truncate text-slate-500">{ROLE[m.role]}</span>
                  </span>
                  <span className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 md:contents">
                    <span><AccountStatusBadge status={m.status} /></span>
                    <span className="text-sm text-slate-600 md:text-right">
                      <span className={`font-display font-semibold tabular-nums ${m.openAssigned ? 'text-slate-900' : 'text-slate-400'}`}>{m.openAssigned}</span>
                      <span className="md:sr-only"> reportes abiertos asignados</span>
                    </span>
                    <span className="text-sm text-slate-500">
                      <span className="md:sr-only">Modificado el </span>
                      <time dateTime={m.updatedAt}>{formatShortDate(m.updatedAt)}</time>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {members.length > 0 && <p className="text-sm text-slate-500">{members.length} {members.length === 1 ? 'persona' : 'personas'}</p>}
    </div>
  )
}
