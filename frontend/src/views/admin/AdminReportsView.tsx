import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ArrowUturnLeftIcon, EyeIcon, MagnifyingGlassIcon, PencilSquareIcon, PlusIcon, TrashIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { deleteReportAsModerator, destroyAdminReport, getAdminReports, restoreReport, type AdminReportFilters } from '@/api/ModerationAPI'
import { useCategories } from '@/hooks/useCategories'
import { STATUS_OPTIONS } from '@/lib/labels'
import { formatRelativeDay } from '@/lib/date'
import { PinStatusIcon, pinKind } from '@/components/map/pinIcons'
import SelectBox from '@/components/ui/SelectBox'
import { SeverityBadge, StatusBadge } from '@/components/ui/Badges'
import ReportFormDialog from '@/components/admin/ReportFormDialog'
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

  const params: AdminReportFilters = { q: q.trim() || undefined, status: status || undefined, category: category || undefined, deleted: deleted || undefined }
  const { data: reports = [], isLoading } = useQuery({ queryKey: ['admin-reports', params], queryFn: () => getAdminReports(params) })

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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Gestionar reportes</h1>
          <p className="text-slate-500">Crea, edita, elimina o restaura cualquier reporte.</p>
        </div>
        <button onClick={() => openForm(null)} className="btn-primary">
          <PlusIcon className="size-5" /> Nuevo reporte
        </button>
      </header>

      <section className="glass flex flex-col gap-3 rounded-2xl p-4 lg:flex-row lg:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Buscar</span>
          <span className="relative block">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título, descripción, calle o colonia" className="input !py-2 pl-10" />
          </span>
        </label>
        <SelectBox label="Estado" value={status} onChange={setStatus} className="lg:w-44" options={[{ value: '' as const, label: 'Todos' }, ...STATUS_OPTIONS]} />
        <SelectBox label="Categoría" value={category} onChange={setCategory} className="lg:w-56" options={categoryOptions} />
        <SelectBox
          label="Registros"
          value={deleted}
          onChange={setDeleted}
          className="lg:w-44"
          options={[
            { value: '' as const, label: 'Activos' },
            { value: 'true' as const, label: 'Eliminados' },
            { value: 'all' as const, label: 'Todos' },
          ]}
        />
      </section>

      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-white/40 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Reporte</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Ubicación</th>
              <th className="px-4 py-3">Autor</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/50">
            {reports.map((r) => (
              <tr key={r.id} className={r.deletedAt ? 'opacity-60' : ''}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <PinStatusIcon kind={pinKind(r)} className="size-7 shrink-0" />
                    <div className="min-w-0">
                      <p className="max-w-64 truncate font-bold text-slate-900">#{r.id} · {r.title}</p>
                      <p className="text-xs font-bold" style={{ color: r.category.color }}>{r.category.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge status={r.status} />
                    <SeverityBadge severity={r.severity} />
                    {r.hidden && <span className="rounded bg-slate-800 px-1.5 text-xs font-bold text-white">Oculto</span>}
                    {r.deletedAt && <span className="rounded bg-red-600 px-1.5 text-xs font-bold text-white">Eliminado</span>}
                  </div>
                </td>
                <td className="max-w-48 truncate px-4 py-3 text-slate-600">{[r.calle, r.colonia].filter(Boolean).join(', ') || `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}</td>
                <td className="px-4 py-3 text-slate-600">
                  {r.author?.name ?? '—'}
                  {r.anonymous && <span className="block text-xs text-slate-400">anónimo</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatRelativeDay(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Link to={`/reports/${r.id}`} className="btn-sm ring-1 ring-slate-300 hover:bg-white/60" title="Ver detalle">
                      <EyeIcon className="size-4" />
                    </Link>
                    <button onClick={() => openForm(r)} className="btn-sm text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50" title="Editar">
                      <PencilSquareIcon className="size-4" />
                    </button>
                    {r.deletedAt ? (
                      <button onClick={() => restore.mutate(r.id)} className="btn-sm text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50" title="Restaurar">
                        <ArrowUturnLeftIcon className="size-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => confirm('¿Eliminar este reporte? Desaparece de la app, pero se conserva para estadísticas y puedes restaurarlo.') && softDelete.mutate(r.id)}
                        className="btn-sm text-red-600 ring-1 ring-red-200 hover:bg-red-50"
                        title="Eliminar (se puede restaurar)"
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    )}
                    <button
                      onClick={() => confirm(`¿Eliminar DEFINITIVAMENTE "${r.title}"? Se borran su foto, historial, votos y denuncias. No se puede deshacer.`) && hardDelete.mutate(r.id)}
                      className="btn-sm bg-red-600 text-white hover:bg-red-700"
                      title="Eliminar definitivamente"
                    >
                      <XCircleIcon className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <p className="p-8 text-center text-slate-500">Cargando…</p>}
        {!isLoading && reports.length === 0 && <p className="p-8 text-center text-slate-500">Sin reportes con estos filtros</p>}
      </div>

      <ReportFormDialog open={formOpen} report={editing} onClose={() => setFormOpen(false)} />
    </div>
  )
}
