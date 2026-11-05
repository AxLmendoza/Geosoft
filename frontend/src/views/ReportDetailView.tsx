import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Marker } from 'react-map-gl/mapbox'
import { toast } from 'react-toastify'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { deleteReport, getReport } from '@/api/ReportAPI'
import { useAuth } from '@/hooks/useAuth'
import { assetUrl } from '@/lib/media'
import { formatDateTime } from '@/lib/date'
import { SEVERITY, isClosed } from '@/lib/labels'
import BaseMap from '@/components/map/BaseMap'
import { ReportPin } from '@/components/map/pinIcons'
import { StatusBadge } from '@/components/ui/Badges'
import { ErrorState, Skeleton } from '@/components/ui/States'
import ImageViewer from '@/components/ui/ImageViewer'
import FlagDialog from '@/components/reports/FlagDialog'
import CommunityVotes from '@/components/reports/CommunityVotes'
import OwnerStatusActions from '@/components/reports/OwnerStatusActions'
import ResolvedNotice from '@/components/reports/ResolvedNotice'
import ReportTimeline from '@/components/reports/ReportTimeline'
import AttentionDialog, { type AttentionMode } from '@/components/reports/AttentionDialog'
import AddInfoDialog from '@/components/reports/AddInfoDialog'

function DetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando reporte">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-2/3" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  )
}

/** Par etiqueta / valor (sin iconos decorativos) */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{children}</dd>
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
  const ownerCanAct = report.isOwner && !closed
  const staffCanAct = report.canManage && !report.deletedAt

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => navigate(-1)} className="btn-link">
          <ArrowLeftIcon className="size-4" aria-hidden /> Volver
        </button>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <span>Folio #{report.id}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: report.category.color }} aria-hidden />
            {report.category.name}
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{report.title}</h1>
        <div className="mt-2"><StatusBadge status={report.status} /></div>
      </div>

      {report.deletedAt && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">Reporte eliminado (borrado lógico). Solo la administración lo ve.</p>
      )}
      {report.hidden && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Oculto al público{report.hiddenReason ? `: ${report.hiddenReason}` : ''}.
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Columna principal: acciones y seguimiento */}
        <div className="min-w-0 space-y-6">
          {staffCanAct && (
            <section className="card space-y-3" aria-labelledby="atender">
              <h2 id="atender" className="text-sm font-bold text-slate-900">Atender este reporte</h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button onClick={() => setAttention('status')} className="btn-primary">Actualizar estado</button>
                <button onClick={() => setAttention('update')} className="btn-secondary">Agregar observación o evidencia</button>
                {isAdmin && (
                  <button onClick={() => setAttention('assign')} className="btn-secondary">{report.area ? 'Cambiar área responsable' : 'Asignar área responsable'}</button>
                )}
              </div>
            </section>
          )}

          {ownerCanAct && (
            <section className="card space-y-3" aria-labelledby="tu-reporte">
              <h2 id="tu-reporte" className="text-sm font-bold text-slate-900">Tu reporte</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <OwnerStatusActions report={report} />
                <button onClick={() => setInfoOpen(true)} className="btn-secondary w-full">Agregar información</button>
              </div>
            </section>
          )}

          <ReportTimeline report={report} />
        </div>

        {/* Columna lateral: foto, datos y ubicación */}
        <aside className="min-w-0 space-y-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
            <ImageViewer src={assetUrl(report.imageUrl)} alt={report.title} className="w-full" thumbClassName="max-h-80 w-full object-contain" />
          </div>

          <section className="card space-y-4" aria-labelledby="datos">
            <h2 id="datos" className="text-sm font-bold text-slate-900">Datos del reporte</h2>
            <p className="whitespace-pre-line text-sm text-slate-700">{report.description}</p>
            <ResolvedNotice report={report} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Fecha">{formatDateTime(report.createdAt)}</Field>
              <Field label="Gravedad">{SEVERITY[report.severity].label}</Field>
              <Field label="Ubicación">{[report.calle, report.colonia].filter(Boolean).join(', ') || `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`}</Field>
              <Field label="Reportado por">
                {report.author ? report.author.name : 'Anónimo'}
                {isStaff && report.author?.email && <span className="block text-xs text-slate-500">{report.author.email}</span>}
                {report.author && report.anonymous && <span className="block text-xs text-slate-500">Anónimo para el público</span>}
              </Field>
            </dl>
          </section>

          {/* La opinión vecinal es para la comunidad, no para quien atiende o hizo el reporte */}
          {!report.isOwner && !report.canManage && !closed && (
            <section className="card"><CommunityVotes report={report} /></section>
          )}

          <section className="relative h-56 overflow-hidden rounded-xl border border-slate-200" aria-label="Ubicación en el mapa">
            <BaseMap center={report} zoom={16} showOverlay={false}>
              <Marker longitude={report.lng} latitude={report.lat} anchor="bottom">
                <ReportPin report={report} />
              </Marker>
            </BaseMap>
          </section>

          {/* Acciones secundarias, discretas y con texto */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {user && !report.isOwner && (
              <button onClick={() => setFlagOpen(true)} className="font-semibold text-slate-600 hover:text-red-700 hover:underline">Denunciar contenido inapropiado</button>
            )}
            {report.isOwner && (
              <button onClick={() => confirm('¿Eliminar este reporte? Ya no aparecerá en el mapa.') && remove.mutate(report.id)} className="font-semibold text-slate-600 hover:text-red-700 hover:underline">
                Eliminar mi reporte
              </button>
            )}
            {isStaff && <Link to="/moderation" className="font-semibold text-slate-600 hover:underline">Ir a moderación</Link>}
          </div>
        </aside>
      </div>

      <FlagDialog reportId={report.id} open={flagOpen} onClose={() => setFlagOpen(false)} />
      <AddInfoDialog reportId={report.id} open={infoOpen} onClose={() => setInfoOpen(false)} />
      {attention && <AttentionDialog report={report} mode={attention} onClose={() => setAttention(null)} />}
    </div>
  )
}
