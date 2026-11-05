import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { updateOwnerStatus } from '@/api/ReportAPI'
import Modal from '@/components/ui/Modal'
import { isClosed } from '@/lib/labels'
import type { Report } from '@/types'

type Target = 'en_proceso' | 'resuelto'

const COPY: Record<Target, { title: string; text: string; button: string }> = {
  en_proceso: {
    title: '¿Ya te dieron seguimiento?',
    text: 'Marca el reporte "Atención en proceso" si ya vinieron a revisar o están trabajando en ello.',
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

  if (!report.isOwner || isClosed(report.status)) return null

  return (
    <>
      {/* El contenedor (tarjeta "Tu reporte") lo pone la vista de detalle */}
      <button onClick={() => setTarget('resuelto')} className="btn-secondary w-full">Ya quedó solucionado</button>
      {report.status !== 'en_proceso' && (
        <button onClick={() => setTarget('en_proceso')} className="btn-secondary w-full">Ya me dieron seguimiento</button>
      )}

      <Modal open={!!target} onClose={() => setTarget(null)} title={target ? COPY[target].title : ''}>
        {target && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{COPY[target].text}</p>
            <textarea rows={3} className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comentario (opcional)" />
            <button
              disabled={isPending}
              onClick={() => mutate({ id: report.id, status: target, note: note.trim() || undefined })}
              className="btn-primary w-full"
            >
              {isPending ? 'Guardando…' : COPY[target].button}
            </button>
          </div>
        )}
      </Modal>
    </>
  )
}
