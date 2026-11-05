import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { deleteReportAsModerator, destroyAdminReport, getAdminReports, restoreReport, type AdminReportFilters } from '@/api/ModerationAPI'
import { useCategories } from '@/hooks/useCategories'
import { STATUS_OPTIONS } from '@/lib/labels'
import { formatRelativeDay } from '@/lib/date'
import SelectBox from '@/components/ui/SelectBox'
import { StatusBadge } from '@/components/ui/Badges'
import ActionMenu from '@/components/ui/ActionMenu'
import Pagination from '@/components/ui/Pagination'
import ReportFormDialog from '@/components/admin/ReportFormDialog'
import { EmptyState, ErrorState, ListSkeleton, RefreshingBadge } from '@/components/ui/States'
import type { Report, ReportStatus } from '@/types'

type Deleted = '' | 'true' | 'all'

export default function AdminReportsView() {
  const queryClient = useQueryClient()
  const { data: categories = [] } = useCategories()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ReportStatus | ''>('')
  const [category, setCategory] = useState(0)
  const [deleted, setDeleted] = useState<Deleted>('')
  const [editing, setEditing] = useState<Report | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE = 50

  // Debounce: antes se consultaba la API con cada tecla
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 350)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => setPage(1), [q, status, category, deleted])

  const params: AdminReportFilters = { q: q.trim() || undefined, status: status || undefined, category: category || undefined, deleted: deleted || undefined, page, limit: PAGE }
  const { data, isLoading, isError, isFetching, isPlaceholderData, refetch } = useQuery({
    queryKey: ['admin-reports', params],
    queryFn: () => getAdminReports(params),
    placeholderData: keepPreviousData,
  })
  const reports = data?.data ?? []
  const pages = Math.ceil((data?.total ?? 0) / PAGE)

  const onDone = (msg: string) => {
    toast.success(msg)
    queryClient.invalidateQueries()
  }
  const softDelete = useMutation({ mutationFn: deleteReportAsModerator, onError: (e) => toast.error(e.message), onSuccess: onDone })
  const hardDelete = useMutation({ mutationFn: destroyAdminReport, onError: (e) => toast.error(e.message), onSuccess: onDone })
  const restore = useMutation({ mutationFn: restoreReport, onError: (e) => toast.error(e.message), onSuccess: onDone })

  const categoryOptions = useMemo(
    () => [{ value: 0, label: 'Todas las categorías' }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
    [categories],
  )

  const openForm = (r: Report | null) => {
    setEditing(r)
    setFormOpen(true)
  }

  /** Acciones de cada reporte: las de uso frecuente visibles, las demás en "Más acciones" */
  const rowActions = (r: Report) => (
    <div className="flex flex-nowrap justify-end gap-2">
      <button onClick={() => openForm(r)} className="btn-secondary btn-compact">Editar</button>
      <ActionMenu
        actions={[
          { label: 'Restaurar', hidden: !r.deletedAt, onClick: () => restore.mutate(r.id) },
          {
            label: 'Eliminar (se puede restaurar)',
            hidden: !!r.deletedAt,
            danger: true,
            onClick: () => confirm('¿Eliminar este reporte? Desaparece de la app, pero se conserva para estadísticas y puedes restaurarlo.') && softDelete.mutate(r.id),
          },
          {
            label: 'Eliminar definitivamente',
            danger: true,
            onClick: () => confirm(`¿Eliminar DEFINITIVAMENTE "${r.title}"? Se borran su foto, historial, votos y denuncias. No se puede deshacer.`) && hardDelete.mutate(r.id),
          },
        ]}
      />
    </div>
  )

  const flags = (r: Report) => (
    <>
      {r.hidden && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">Oculto</span>}
      {r.deletedAt && <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">Eliminado</span>}
    </>
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">Registro de reportes <RefreshingBadge show={isFetching && !isLoading} /></h1>
          <p className="page-subtitle">Consulta, edita, elimina o restaura cualquier reporte. Para atenderlos usa la Bandeja de atención.</p>
        </div>
        <button onClick={() => openForm(null)} className="btn-primary">Registrar reporte</button>
      </header>

      <section className="glass grid gap-3 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-[1fr_11rem_14rem_11rem] lg:items-end">
        <label className="sm:col-span-2 lg:col-span-1">
          <span className="label">Buscar</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título, descripción, calle o colonia" className="input !py-2" type="search" />
        </label>
        <SelectBox label="Estado" value={status} onChange={setStatus} options={[{ value: '' as const, label: 'Todos' }, ...STATUS_OPTIONS]} />
        <SelectBox label="Categoría" value={category} onChange={setCategory} options={categoryOptions} />
        <SelectBox
          label="Mostrar"
          value={deleted}
          onChange={setDeleted}
          options={[
            { value: '' as const, label: 'Activos' },
            { value: 'true' as const, label: 'Eliminados' },
            { value: 'all' as const, label: 'Todos' },
          ]}
        />
      </section>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : reports.length === 0 ? (
        <EmptyState title="Sin reportes con estos filtros" />
      ) : (
        <div className={`transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {/* Celular: lista (sin desplazamiento horizontal) */}
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white md:hidden">
            {reports.map((r) => (
              <li key={r.id} className={`space-y-2 p-4 ${r.deletedAt ? 'opacity-60' : ''}`}>
                <Link to={`/reports/${r.id}`} className="block font-semibold text-slate-900 hover:underline"><span className="font-normal text-slate-400">#{r.id}</span> {r.title}</Link>
                <div className="flex flex-wrap items-center gap-1.5"><StatusBadge status={r.status} short />{flags(r)}</div>
                <p className="text-xs text-slate-500">{r.category.name} · {r.area?.name ?? 'Sin área'} · {formatRelativeDay(r.createdAt)}</p>
                <div className="flex justify-start">{rowActions(r)}</div>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Reporte</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="hidden px-4 py-3 2xl:table-cell">Autor</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <tr key={r.id} className={r.deletedAt ? 'opacity-60' : ''}>
                    <td className="px-4 py-3">
                      <Link to={`/reports/${r.id}`} className="block max-w-72 truncate font-semibold text-slate-900 hover:text-indigo-700 hover:underline"><span className="font-normal text-slate-400">#{r.id}</span> {r.title}</Link>
                      <p className="text-xs text-slate-500">{r.category.name}{r.colonia ? ` · ${r.colonia}` : ''}</p>
                    </td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><StatusBadge status={r.status} short />{flags(r)}</div></td>
                    <td className="max-w-44 truncate px-4 py-3 text-slate-600">{r.area?.name ?? <span className="text-amber-700">Sin área</span>}</td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-slate-600 2xl:table-cell">{r.author?.name ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatRelativeDay(r.createdAt)}</td>
                    <td className="px-4 py-3">{rowActions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={page} pages={pages} total={data?.total ?? 0} onChange={setPage} />

      <ReportFormDialog open={formOpen} report={editing} onClose={() => setFormOpen(false)} />
    </div>
  )
}
