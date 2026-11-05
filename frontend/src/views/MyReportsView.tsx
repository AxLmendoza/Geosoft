import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CameraIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline'
import { getMyReports } from '@/api/ReportAPI'
import { isClosed } from '@/lib/labels'
import ReportCard from '@/components/reports/ReportCard'
import { EmptyState, ErrorState, RefreshingBadge, ReportCardSkeleton } from '@/components/ui/States'

type Tab = 'abiertos' | 'cerrados' | 'todos'

export default function MyReportsView() {
  const { data: reports = [], isLoading, isError, isFetching, refetch } = useQuery({ queryKey: ['reports', 'mine'], queryFn: getMyReports })
  const [tab, setTab] = useState<Tab>('abiertos')

  const counts = useMemo(() => {
    const closed = reports.filter((r) => isClosed(r.status)).length
    return { abiertos: reports.length - closed, cerrados: closed, todos: reports.length }
  }, [reports])

  const list = useMemo(
    () => reports.filter((r) => (tab === 'todos' ? true : tab === 'cerrados' ? isClosed(r.status) : !isClosed(r.status))),
    [reports, tab],
  )

  const tabs: { id: Tab; label: string }[] = [
    { id: 'abiertos', label: 'En curso' },
    { id: 'cerrados', label: 'Finalizados' },
    { id: 'todos', label: 'Todos' },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Mis reportes <RefreshingBadge show={isFetching && !isLoading} />
          </h1>
          <p className="text-slate-500">Consulta en qué va cada uno de tus reportes.</p>
        </div>
        <Link to="/reports/new" className="btn-primary max-sm:hidden">
          <CameraIcon className="size-5" /> Nuevo reporte
        </Link>
      </header>

      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-900/5 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition sm:flex-none ${
              tab === t.id ? 'bg-white text-indigo-700 shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 text-xs ${tab === t.id ? 'bg-indigo-100' : 'bg-slate-900/10'}`}>{isLoading ? '·' : counts[t.id]}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <ReportCardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <ErrorState message="No pudimos cargar tus reportes." onRetry={() => refetch()} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<ClipboardDocumentListIcon className="size-6" />}
          title="Aún no has hecho reportes"
          text="Toma una foto del problema, marca el lugar y nosotros lo hacemos llegar al área responsable."
          action={<Link to="/reports/new" className="btn-primary">Hacer mi primer reporte</Link>}
        />
      ) : list.length === 0 ? (
        <EmptyState title={tab === 'abiertos' ? 'No tienes reportes en curso' : 'No tienes reportes finalizados'} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => <ReportCard key={r.id} report={r} showProgress />)}
        </div>
      )}
    </div>
  )
}
