import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { CheckCircleIcon, EyeSlashIcon, NoSymbolIcon, SparklesIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { getFlags, reviewFlag } from '@/api/ModerationAPI'
import { FLAG_REASON } from '@/lib/labels'
import { assetUrl } from '@/lib/media'
import { formatRelativeDay } from '@/lib/date'
import SelectBox from '@/components/ui/SelectBox'
import BanDialog from './BanDialog'
import type { FlagStatus } from '@/types'

export default function FlagsPanel() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<FlagStatus>('pendiente')
  const [banTarget, setBanTarget] = useState<{ id: number; name: string; email?: string } | null>(null)
  const { data: flags = [], isLoading } = useQuery({ queryKey: ['flags', status], queryFn: () => getFlags(status) })

  const review = useMutation({
    mutationFn: reviewFlag,
    onError: (e) => toast.error(e.message),
    onSuccess: (msg) => {
      toast.success(msg)
      queryClient.invalidateQueries()
    },
  })

  return (
    <div className="space-y-4">
      <SelectBox
        value={status}
        onChange={setStatus}
        className="w-56"
        options={[
          { value: 'pendiente', label: 'Pendientes' },
          { value: 'procedente', label: 'Procedentes' },
          { value: 'descartada', label: 'Descartadas' },
        ]}
      />
      {isLoading && <p className="text-slate-500">Cargando…</p>}
      {!isLoading && flags.length === 0 && <p className="flex items-center justify-center gap-2 rounded-xl glass p-8 text-center text-slate-500"><SparklesIcon className="size-5 text-indigo-500" /> Sin denuncias</p>}

      {flags.map((f) => (
        <article key={f.id} className="flex flex-col gap-4 rounded-2xl glass p-4 sm:flex-row">
          {f.report && (
            <img src={assetUrl(f.report.thumbUrl)} alt="" className="size-24 shrink-0 rounded-xl object-cover" />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm">
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{FLAG_REASON[f.reason]}</span>
              <span className="ml-2 text-xs text-slate-500">{formatRelativeDay(f.createdAt)} · por {f.reporter?.name}</span>
            </p>
            {f.comment && <p className="text-sm italic text-slate-600">“{f.comment}”</p>}
            {f.report ? (
              <>
                <Link to={`/reports/${f.report.id}`} className="block truncate font-bold text-slate-900 hover:text-indigo-700">
                  {f.report.title}
                </Link>
                <p className="text-xs text-slate-500">
                  Autor: {f.report.author?.name} ({f.report.author?.email}){f.report.author?.banned && ' · BANEADO'}
                  {f.report.hidden && ' · reporte oculto'}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">Reporte eliminado</p>
            )}
          </div>
          {status === 'pendiente' && f.report && (
            <div className="flex flex-wrap gap-2 sm:w-48 sm:flex-col">
              <button onClick={() => review.mutate({ id: f.id, status: 'procedente', hideReport: true })} className="btn-sm bg-amber-500 text-white hover:bg-amber-600">
                <EyeSlashIcon className="size-4" /> Procede y ocultar
              </button>
              <button onClick={() => review.mutate({ id: f.id, status: 'procedente' })} className="btn-sm bg-emerald-600 text-white hover:bg-emerald-700">
                <CheckCircleIcon className="size-4" /> Procede
              </button>
              <button onClick={() => review.mutate({ id: f.id, status: 'descartada' })} className="btn-sm ring-1 ring-slate-300 hover:bg-slate-50">
                <XCircleIcon className="size-4" /> Descartar
              </button>
              {f.report.author && !f.report.author.banned && (
                <button onClick={() => setBanTarget(f.report!.author!)} className="btn-sm bg-red-600 text-white hover:bg-red-700">
                  <NoSymbolIcon className="size-4" /> Banear autor
                </button>
              )}
            </div>
          )}
        </article>
      ))}
      <BanDialog user={banTarget} onClose={() => setBanTarget(null)} />
    </div>
  )
}
