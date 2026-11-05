import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { HandThumbDownIcon, HandThumbUpIcon } from '@heroicons/react/24/outline'
import { deleteReportAsModerator, getModerationReports, restoreReport, setReportVisibility, updateReportStatus } from '@/api/ModerationAPI'
import { useAuth } from '@/hooks/useAuth'
import { STATUS_OPTIONS, isClosed } from '@/lib/labels'
import { assetUrl } from '@/lib/media'
import { formatRelativeDay } from '@/lib/date'
import SelectBox from '@/components/ui/SelectBox'
import ActionMenu from '@/components/ui/ActionMenu'
import { SeverityBadge, StatusBadge } from '@/components/ui/Badges'
import { ListSkeleton } from '@/components/ui/States'
import StatusDialog from './StatusDialog'
import BanDialog from './BanDialog'
import type { Report, ReportStatus } from '@/types'

type View = '' | 'comunidad' | 'visibles' | 'ocultos' | 'eliminados'

export default function ReportsPanel() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<ReportStatus | ''>('')
  const { isAdmin } = useAuth()
  const [view, setView] = useState<View>('')
  const [statusTarget, setStatusTarget] = useState<Report | null>(null)
  const [banTarget, setBanTarget] = useState<{ id: number; name: string; email?: string } | null>(null)

  const params = {
    status: status || undefined,
    hidden: view === 'visibles' ? ('false' as const) : view === 'ocultos' ? ('true' as const) : undefined,
    deleted: view === 'eliminados' ? ('true' as const) : undefined,
    community: view === 'comunidad' ? ('solucionado' as const) : undefined,
  }
  const { data: reports = [], isLoading } = useQuery({ queryKey: ['moderation-reports', params], queryFn: () => getModerationReports(params) })

  const onDone = (msg: string) => {
    toast.success(msg)
    queryClient.invalidateQueries()
  }
  const visibility = useMutation({ mutationFn: setReportVisibility, onError: (e) => toast.error(e.message), onSuccess: onDone })
  const remove = useMutation({ mutationFn: deleteReportAsModerator, onError: (e) => toast.error(e.message), onSuccess: onDone })
  const restore = useMutation({ mutationFn: restoreReport, onError: (e) => toast.error(e.message), onSuccess: onDone })
  const resolve = useMutation({ mutationFn: updateReportStatus, onError: (e) => toast.error(e.message), onSuccess: onDone })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <SelectBox value={status} onChange={setStatus} className="w-48" options={[{ value: '' as const, label: 'Todos los estados' }, ...STATUS_OPTIONS]} />
        <SelectBox
          value={view}
          onChange={setView}
          className="w-64"
          options={[
            { value: '' as const, label: 'Todos (visibles y ocultos)' },
            { value: 'comunidad' as const, label: 'La comunidad dice que ya quedó' },
            { value: 'visibles' as const, label: 'Solo visibles' },
            { value: 'ocultos' as const, label: 'Solo ocultos' },
            { value: 'eliminados' as const, label: 'Eliminados (borrado lógico)' },
          ]}
        />
      </div>

      {isLoading && <ListSkeleton rows={4} />}

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl glass">
        {reports.map((r) => {
          const pendingFlags = r.flags?.filter((f) => f.status === 'pendiente').length ?? 0
          return (
            <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <img src={assetUrl(r.thumbUrl)} alt="" className={`size-16 shrink-0 rounded-lg object-cover ${r.hidden ? 'opacity-40 grayscale' : ''}`} />
              <div className="min-w-0 flex-1">
                <Link to={`/reports/${r.id}`} className="block truncate font-bold text-slate-900 hover:text-indigo-700">{r.title}</Link>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-bold" style={{ color: r.category.color }}>{r.category.name}</span>
                  <StatusBadge status={r.status} />
                  <SeverityBadge severity={r.severity} />
                  {pendingFlags > 0 && <span className="rounded bg-red-100 px-1.5 font-bold text-red-700">{pendingFlags} denuncias</span>}
                  {r.hidden && <span className="rounded bg-slate-800 px-1.5 font-bold text-white">Oculto</span>}
                  {r.deletedAt && <span className="rounded bg-red-600 px-1.5 font-bold text-white">Eliminado</span>}
                  <span title="La comunidad dice que ya quedó / sigue igual" className="flex items-center gap-1">
                    <HandThumbUpIcon className="size-3.5" /> {r.votes.solucionado} · <HandThumbDownIcon className="size-3.5" /> {r.votes.sin_solucion}
                  </span>
                  <span>· {formatRelativeDay(r.createdAt)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {r.author?.name} · {r.author?.email} {r.anonymous && '(anónimo)'} {r.author?.banned && '· Suspendido'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.deletedAt ? (
                  isAdmin && <button onClick={() => restore.mutate(r.id)} className="btn-secondary btn-compact">Restaurar</button>
                ) : (
                  <>
                    <button
                      onClick={() => visibility.mutate({ id: r.id, hidden: !r.hidden, reason: r.hidden ? undefined : 'Contenido no apto' })}
                      className="btn-secondary btn-compact"
                    >
                      {r.hidden ? 'Mostrar en el mapa' : 'Ocultar del mapa'}
                    </button>
                    <ActionMenu
                      actions={[
                        {
                          label: `Marcar solucionado (${r.votes.solucionado} vecinos)`,
                          hidden: isClosed(r.status) || r.votes.solucionado === 0,
                          onClick: () => resolve.mutate({ id: r.id, status: 'resuelto', note: `Confirmado por moderación (${r.votes.solucionado} vecinos dijeron que ya quedó)` }),
                        },
                        { label: 'Cambiar estado', onClick: () => setStatusTarget(r) },
                        { label: 'Suspender al autor', hidden: !r.author || !!r.author.banned, danger: true, onClick: () => setBanTarget(r.author!) },
                        {
                          label: 'Eliminar (se puede restaurar)',
                          danger: true,
                          onClick: () => confirm('¿Eliminar este reporte? Desaparece de la app, pero el administrador lo conserva y puede restaurarlo.') && remove.mutate(r.id),
                        },
                      ]}
                    />
                  </>
                )}
              </div>
            </div>
          )
        })}
        {!isLoading && reports.length === 0 && <p className="p-8 text-center text-slate-500">Sin reportes</p>}
      </div>

      <StatusDialog report={statusTarget} onClose={() => setStatusTarget(null)} />
      <BanDialog user={banTarget} onClose={() => setBanTarget(null)} />
    </div>
  )
}
