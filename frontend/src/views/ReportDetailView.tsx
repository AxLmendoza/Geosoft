import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Marker } from 'react-map-gl/mapbox'
import { toast } from 'react-toastify'
import { CalendarDaysIcon, FlagIcon, MapPinIcon, TrashIcon, UserCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { deleteReport, getReport } from '@/api/ReportAPI'
import { useAuth } from '@/hooks/useAuth'
import { assetUrl } from '@/lib/media'
import { formatDateTime, timeAgo } from '@/lib/date'
import { STATUS, ROLE } from '@/lib/labels'
import BaseMap from '@/components/map/BaseMap'
import { ReportPin } from '@/components/map/pinIcons'
import { SeverityBadge, StatusBadge } from '@/components/ui/Badges'
import CategoryIcon from '@/components/CategoryIcon'
import FlagDialog from '@/components/reports/FlagDialog'
import CommunityVotes from '@/components/reports/CommunityVotes'
import OwnerStatusActions from '@/components/reports/OwnerStatusActions'
import ResolvedNotice from '@/components/reports/ResolvedNotice'

export default function ReportDetailView() {
  const id = Number(useParams().reportId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isStaff } = useAuth()
  const [flagOpen, setFlagOpen] = useState(false)

  const { data: report, isLoading, isError } = useQuery({ queryKey: ['report', id], queryFn: () => getReport(id), retry: false })

  const remove = useMutation({
    mutationFn: deleteReport,
    onError: (e) => toast.error(e.message),
    onSuccess: (msg) => {
      toast.success(msg)
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      navigate('/reports/mine')
    },
  })

  if (isLoading) return <p className="py-20 text-center text-slate-500">Cargando…</p>
  if (isError || !report) return <p className="py-20 text-center text-slate-500">El reporte no existe o fue retirado.</p>

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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

      <article className="overflow-hidden rounded-3xl glass">
        <img src={assetUrl(report.imageUrl)} alt={report.title} className="max-h-[480px] w-full bg-slate-900 object-contain" />
        <div className="space-y-4 p-5 sm:p-8">
          <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold text-white" style={{ backgroundColor: report.category.color }}>
            <CategoryIcon slug={report.category.slug} className="size-4" /> {report.category.name}
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900">{report.title}</h1>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={report.status} />
            <SeverityBadge severity={report.severity} />
          </div>
          <ResolvedNotice report={report} />
          <p className="whitespace-pre-line text-slate-700">{report.description}</p>

          <dl className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="size-5 text-slate-400" />
              <span title={formatDateTime(report.createdAt)}>{formatDateTime(report.createdAt)} · {timeAgo(report.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPinIcon className="size-5 text-slate-400" />
              {[report.calle, report.colonia].filter(Boolean).join(', ') || `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`}
            </div>
            <div className="flex items-center gap-2">
              <UserCircleIcon className="size-5 text-slate-400" />
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

          <div className="flex flex-wrap gap-2 pt-2">
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
              <Link to="/moderation" className="rounded-lg px-3 py-2 text-sm font-bold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50">
                Moderar
              </Link>
            )}
          </div>
        </div>
      </article>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="relative h-72 overflow-hidden rounded-2xl ring-1 ring-slate-200">
          <BaseMap center={report} zoom={16}>
            <Marker longitude={report.lng} latitude={report.lat} anchor="bottom">
              <ReportPin report={report} />
            </Marker>
          </BaseMap>
        </section>

        <section className="card">
          <h2 className="card-title">Seguimiento</h2>
          <ol className="relative space-y-4 border-l-2 border-indigo-100 pl-5">
            {report.history?.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[27px] top-1 size-3 rounded-full bg-indigo-500 ring-4 ring-white" />
                <p className="text-sm font-bold text-slate-800">{STATUS[h.toStatus].label}</p>
                <p className="text-xs text-slate-500">
                  {formatDateTime(h.createdAt)}
                  {h.changedBy && h.changedBy.role !== 'ciudadano' && ` · ${h.changedBy.name ?? ROLE[h.changedBy.role]}`}
                </p>
                {h.note && <p className="mt-1 text-sm text-slate-600">{h.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <FlagDialog reportId={report.id} open={flagOpen} onClose={() => setFlagOpen(false)} />
    </div>
  )
}
