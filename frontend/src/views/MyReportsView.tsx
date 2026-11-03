import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMyReports } from '@/api/ReportAPI'
import ReportCard from '@/components/reports/ReportCard'

export default function MyReportsView() {
  const { data: reports = [], isLoading } = useQuery({ queryKey: ['reports', 'mine'], queryFn: getMyReports })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Mis reportes</h1>
          <p className="text-slate-500">Da seguimiento al estado de atención de lo que has reportado.</p>
        </div>
        <Link to="/reports/new" className="btn-primary">Nuevo reporte</Link>
      </header>
      {isLoading ? (
        <p className="text-slate-500">Cargando…</p>
      ) : reports.length === 0 ? (
        <p className="rounded-2xl glass p-10 text-center text-slate-500">Aún no has hecho reportes.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => <ReportCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  )
}
