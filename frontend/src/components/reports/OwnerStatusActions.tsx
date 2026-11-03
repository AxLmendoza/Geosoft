import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { CheckBadgeIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { updateOwnerStatus } from '@/api/ReportAPI'
import Modal from '@/components/ui/Modal'
import type { Report } from '@/types'

type Target = 'en_proceso' | 'resuelto'

const COPY: Record<Target, { title: string; text: string; button: string }> = {
  en_proceso: {
    title: '¿Ya te dieron seguimiento?',
    text: 'Marca el reporte "En proceso" si ya vinieron a revisar o están trabajando en ello.',
    button: 'Sí, ya le están dando seguimiento',
  },
  resuelto: {
    title: '¿Ya quedó solucionado?',
    text: 'El reporte se marcará como resuelto y se retirará del mapa en 2 días. Seguirá en tu historial.',
    button: 'Sí, ya quedó',
  },
}

/** Botones para el ciudadano que hizo el reporte */
export default function OwnerStatusActions({ report }: { report: Report }) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<Target | null>(null)
  const [note, setNote] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: updateOwnerStatus,
    onError: (e) => toast.error(e.message),
    onSuccess: (msg) => {
      toast.success(msg)
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['report', report.id] })
      setTarget(null)
      setNote('')
    },
  })

  if (!report.isOwner || report.status === 'resuelto' || report.status === 'rechazado') return null

  return (
    <div className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-100">
      <p className="text-sm font-bold text-indigo-900">Actualiza tu reporte</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        {report.status !== 'en_proceso' && (
          <button onClick={() => setTarget('en_proceso')} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100">
            <WrenchScrewdriverIcon className="size-5" /> Me dieron seguimiento
          </button>
        )}
        <button onClick={() => setTarget('resuelto')} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
          <CheckBadgeIcon className="size-5" /> Ya quedó solucionado
        </button>
      </div>

      <Modal open={!!target} onClose={() => setTarget(null)} title={target ? COPY[target].title : ''}>
        {target && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{COPY[target].text}</p>
            <textarea rows={3} className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comentario (opcional)" />
            <button
              disabled={isPending}
              onClick={() => mutate({ id: report.id, status: target, note: note.trim() || undefined })}
              className={`w-full rounded-xl py-3 font-bold text-white disabled:opacity-50 ${target === 'resuelto' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {isPending ? 'Guardando…' : COPY[target].button}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
