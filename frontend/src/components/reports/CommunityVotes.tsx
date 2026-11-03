import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { HandThumbDownIcon, HandThumbUpIcon } from '@heroicons/react/24/outline'
import { voteReport } from '@/api/ReportAPI'
import { useAuth } from '@/hooks/useAuth'
import type { Report, VoteValue } from '@/types'

/**
 * "Clap" de la comunidad: los vecinos dicen si ya quedó o sigue igual.
 * Es informativo: el moderador / admin / autor deciden el estado final.
 */
export default function CommunityVotes({ report, compact = false }: { report: Report; compact?: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { votes } = report
  const closed = report.status === 'resuelto' || report.status === 'rechazado'
  const disabled = closed || report.isOwner

  const { mutate, isPending } = useMutation({
    mutationFn: voteReport,
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['report', report.id] })
    },
  })

  const vote = (value: VoteValue) => {
    if (!user) return navigate('/auth/login')
    mutate({ id: report.id, value })
  }

  const total = votes.solucionado + votes.sin_solucion
  const pct = total ? Math.round((votes.solucionado / total) * 100) : 0

  const base = `flex flex-1 items-center justify-center gap-1.5 rounded-xl font-bold ring-1 transition disabled:cursor-not-allowed disabled:opacity-60 ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2.5 text-sm'}`

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {!compact && <p className="text-sm font-bold text-slate-700">¿Ya lo solucionaron?</p>}
      <div className="flex gap-2">
        <button
          onClick={() => vote('solucionado')}
          disabled={disabled || isPending}
          className={`${base} ${votes.mine === 'solucionado' ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-emerald-700 ring-emerald-200 hover:bg-emerald-50'}`}
          aria-pressed={votes.mine === 'solucionado'}
        >
          <HandThumbUpIcon className="size-4" /> Ya quedó · {votes.solucionado}
        </button>
        <button
          onClick={() => vote('sin_solucion')}
          disabled={disabled || isPending}
          className={`${base} ${votes.mine === 'sin_solucion' ? 'bg-slate-700 text-white ring-slate-700' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}
          aria-pressed={votes.mine === 'sin_solucion'}
        >
          <HandThumbDownIcon className="size-4" /> Sigue igual · {votes.sin_solucion}
        </button>
      </div>
      {!compact && total > 0 && (
        <div>
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${pct}% dice que ya quedó`}>
            <div className="bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {pct}% de {total} vecino{total === 1 ? '' : 's'} dice que ya quedó. Un moderador confirmará el cierre.
          </p>
        </div>
      )}
      {!compact && report.isOwner && !closed && (
        <p className="text-xs text-slate-500">Como autor, usa los botones de abajo para actualizar tu reporte.</p>
      )}
    </div>
  )
}
