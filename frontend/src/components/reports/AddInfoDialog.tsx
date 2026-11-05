import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { addReportInfo } from '@/api/ReportAPI'
import Modal from '@/components/ui/Modal'
import PhotoAttach from './PhotoAttach'

/** El ciudadano complementa su reporte (más detalles o una foto nueva) */
export default function AddInfoDialog({ reportId, open, onClose }: { reportId: number; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const { mutate, isPending } = useMutation({
    mutationFn: addReportInfo,
    onError: (e) => toast.error(e.message),
    onSuccess: (msg) => {
      toast.success(msg)
      queryClient.invalidateQueries({ queryKey: ['report', reportId] })
      setNote('')
      setImage(null)
      onClose()
    },
  })

  return (
    <Modal open={open} onClose={onClose} title="Agregar información">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">¿Cambió algo? ¿Tienes más detalles? El área responsable lo verá en el seguimiento.</p>
        <textarea rows={4} maxLength={600} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. La fuga creció y ya llega a la esquina" />
        <PhotoAttach value={image} onChange={setImage} />
        <button disabled={isPending || (!note.trim() && !image)} onClick={() => mutate({ id: reportId, note: note.trim() || undefined, image })} className="btn-primary w-full">
          {isPending ? 'Enviando…' : 'Agregar al seguimiento'}
        </button>
      </div>
    </Modal>
  )
}
