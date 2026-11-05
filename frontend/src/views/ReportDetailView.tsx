import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Marker } from 'react-map-gl/mapbox'
import { toast } from 'react-toastify'
import {
  ArrowLeftIcon, ArrowPathIcon, BuildingOffice2Icon, CalendarDaysIcon, ChatBubbleLeftEllipsisIcon, FlagIcon, MapPinIcon,
  PlusCircleIcon, TrashIcon, UserCircleIcon,
} from '@heroicons/react/24/outline'
import { deleteReport, getReport } from '@/api/ReportAPI'
import { useAuth } from '@/hooks/useAuth'
import { assetUrl } from '@/lib/media'
import { formatDateTime, timeAgo } from '@/lib/date'
import { isClosed } from '@/lib/labels'
import BaseMap from '@/components/map/BaseMap'
import { ReportPin } from '@/components/map/pinIcons'
import { SeverityBadge, StatusBadge } from '@/components/ui/Badges'
import { ErrorState, Skeleton } from '@/components/ui/States'
import ImageViewer from '@/components/ui/ImageViewer'
import CategoryIcon from '@/components/CategoryIcon'
import FlagDialog from '@/components/reports/FlagDialog'
import CommunityVotes from '@/components/reports/CommunityVotes'
import OwnerStatusActions from '@/components/reports/OwnerStatusActions'
import ResolvedNotice from '@/components/reports/ResolvedNotice'
import ReportTimeline from '@/components/reports/ReportTimeline'
import AttentionDialog, { type AttentionMode } from '@/components/reports/AttentionDialog'
import AddInfoDialog from '@/components/reports/AddInfoDialog'

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" role="status" aria-label="Cargando reporte">
      <Skeleton className="h-5 w-20" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4 rounded-3xl glass p-0">
          <Skeleton className="h-72 w-full rounded-b-none rounded-t-3xl" />
          <div className="space-y-3 p-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <div className="space-y-4 rounded-2xl glass p-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  )
}

export default function ReportDetailView() {
  const id = Number(useParams().reportId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isStaff, isAdmin } = useAuth()
  const [flagOpen, setFlagOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [attention, setAttention] = useState<AttentionMode | null>(null)

  const { data: report, isLoading, isError, error, refetch } = useQuery({ queryKey: ['report', id], queryFn: () => getReport(id), retry: false })

  const remove = useMutation({
    mutationFn: deleteReport,
    onError: (e) => toast.error(e.message),
    onSuccess: (msg) => {
      toast.success(msg)
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      navigate('/reports/mine')
    },
  })

  if (isLoading) return <DetailSkeleton />
  if (isError || !report) {
    const notFound = (error as { response?: { status?: number } } | null)?.response?.status === 404
    return notFound ? (
      <p className="py-20 text-center text-slate-500">El reporte no existe o fue retirado.</p>
    ) : (
      <div className="mx-auto max-w-lg py-10"><ErrorState message="No pudimos cargar el reporte." onRetry={() => refetch()} /></div>
    )
  }

  const closed = isClosed(report.status)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-bold text-indigo-600">
        <ArrowLeftIcon className="size-4" /> Volver
      </button>

      {report.deletedAt && (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800 ring-1 ring-red-200">
          Reporte eliminado {timeAgo(report.deletedAt)} (borrado lógico). Solo el administrador lo ve.
        </p>
      )}
      {report.hidden && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
          Este reporte está oculto al público{report.hiddenReason ? `: ${report.hiddenReason}` : ''}.
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <article className="overflow-hidden rounded-3xl glass">
            <ImageViewer
              src={assetUrl(report.imageUrl)}
              alt={report.title}
              className="w-full bg-slate-900"
              thumbClassName="max-h-[440px] w-full object-contain"
            />
            <div className="space-y-4 p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold text-white" style={{ backgroundColor: report.category.color }}>
                  <CategoryIcon slug={report.category.slug} className="size-4" /> {report.category.name}
                </span>
                <span className="text-sm font-semibold text-slate-400">Folio #{report.id}</span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{report.title}</h1>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={report.status} />
                <SeverityBadge severity={report.severity} />
              </div>
              <ResolvedNotice report={report} />
              <p className="whitespace-pre-line text-slate-700">{report.description}</p>

              <dl className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <CalendarDaysIcon className="size-5 shrink-0 text-slate-400" />
                  <span>{formatDateTime(report.createdAt)} · {timeAgo(report.createdAt)}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPinIcon className="size-5 shrink-0 text-slate-400" />
                  {[report.calle, report.colonia].filter(Boolean).join(', ') || `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`}
                </div>
                <div className="flex items-start gap-2">
                  <BuildingOffice2Icon className="size-5 shrink-0 text-slate-400" />
                  {report.area ? report.area.name : 'Área por asignar'}
                </div>
                <div className="flex items-start gap-2">
                  <UserCircleIcon className="size-5 shrink-0 text-slate-400" />
                  {report.author ? (
                    <span>
                      {report.author.name}
                      {isStaff && report.author.email && <span className="block text-xs text-slate-400">{report.author.email}</span>}
                      {report.anonymous && <span className="ml-1 rounded bg-slate-100 px-1 text-xs">anónimo al público</span>}
                    </span>
                  ) : 'Anónimo'}
                </div>
              </dl>

              <CommunityVotes report={report} />
              <OwnerStatusActions report={report} />

              <div className="flex flex-wrap gap-2 pt-1">
                {report.isOwner && !closed && (
                  <button onClick={() => setInfoOpen(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50">
                    <PlusCircleIcon className="size-4" /> Agregar información
                  </button>
                )}
                {user && !report.isOwner && (
                  <button onClick={() => setFlagOpen(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
                    <FlagIcon className="size-4" /> Denunciar
                  </button>
                )}
                {report.isOwner && (
                  <button
                    onClick={() => confirm('¿Eliminar este reporte?') && remove.mutate(report.id)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    <TrashIcon className="size-4" /> Eliminar
                  </button>
                )}
                {isStaff && (
                  <Link to="/moderation" className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                    Moderar
                  </Link>
                )}
              </div>
            </div>
          </article>

          <section className="relative h-64 overflow-hidden rounded-2xl ring-1 ring-slate-200 sm:h-72">
            <BaseMap center={report} zoom={16}>
              <Marker longitude={report.lng} latitude={report.lat} anchor="bottom">
                <ReportPin report={report} />
              </Marker>
            </BaseMap>
          </section>
        </div>

        {/* Para el autor y el personal, en el celular el seguimiento va primero (como una app de pedidos) */}
        <aside className={`space-y-4 lg:sticky lg:top-6 ${report.isOwner || report.canManage ? 'max-lg:order-first' : ''}`}>
          {report.canManage && !report.deletedAt && (
            <section className="rounded-2xl bg-indigo-950 p-4 text-white shadow-xl shadow-indigo-950/20">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-200">Atención del reporte</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setAttention('status')} className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-indigo-900 hover:bg-indigo-50">
                  <ArrowPathIcon className="size-4" /> Estado
                </button>
                <button onClick={() => setAttention('update')} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold ring-1 ring-white/20 hover:bg-white/20">
                  <ChatBubbleLeftEllipsisIcon className="size-4" /> Observación
                </button>
                {isAdmin && (
                  <button onClick={() => setAttention('assign')} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold ring-1 ring-white/20 hover:bg-white/20">
                    <BuildingOffice2Icon className="size-4" /> {report.area ? 'Reasignar o canalizar' : 'Asignar área'}
                  </button>
                )}
              </div>
            </section>
          )}
          <ReportTimeline report={report} />
        </aside>
      </div>

      <FlagDialog reportId={report.id} open={flagOpen} onClose={() => setFlagOpen(false)} />
      <AddInfoDialog reportId={report.id} open={infoOpen} onClose={() => setInfoOpen(false)} />
      {attention && <AttentionDialog report={report} mode={attention} onClose={() => setAttention(null)} />}
    </div>
  )
}
