import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import Modal from '@/components/ui/Modal'
import SelectBox from '@/components/ui/SelectBox'
import { updateReportStatus } from '@/api/ModerationAPI'
import { STATUS_OPTIONS } from '@/lib/labels'
import type { Report, ReportStatus } from '@/types'

export default function StatusDialog({ report, onClose }: { report: Report | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<ReportStatus>('en_revision')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (report) {
      setStatus(report.status)
      setNote('')
    }
  }, [report])

  const { mutate, isPending } = useMutation({
    mutationFn: updateReportStatus,
    onError: (e) => toast.error(e.message),
    onSuccess: (msg) => {
      toast.success(msg)
      queryClient.invalidateQueries()
      onClose()
    },
  })

  return (
    <Modal open={!!report} onClose={onClose} title="Cambiar estado">
      {report && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{report.title}</p>
          <SelectBox label="Nuevo estado" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <div>
            <label className="label" htmlFor="note">Nota para el seguimiento (visible al público)</label>
            <textarea id="note" rows={3} className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Se canalizó a la dirección de obras públicas" />
          </div>
          <button
            disabled={isPending || status === report.status}
            onClick={() => mutate({ id: report.id, status, note: note.trim() || undefined })}
            className="btn-primary w-full"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}
    </Modal>
  )
}
