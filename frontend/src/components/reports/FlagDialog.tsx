import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Radio, RadioGroup } from '@headlessui/react'
import { toast } from 'react-toastify'
import Modal from '@/components/ui/Modal'
import { flagReport } from '@/api/ReportAPI'
import { FLAG_REASON } from '@/lib/labels'
import type { FlagReason } from '@/types'

type Props = { reportId: number; open: boolean; onClose: () => void }

export default function FlagDialog({ reportId, open, onClose }: Props) {
  const [reason, setReason] = useState<FlagReason>('informacion_falsa')
  const [comment, setComment] = useState('')
  const { mutate, isPending } = useMutation({
    mutationFn: flagReport,
    onError: (e) => toast.error(e.message),
    onSuccess: (msg) => {
      toast.success(msg)
      onClose()
    },
  })

  return (
    <Modal open={open} onClose={onClose} title="Denunciar reporte">
      <RadioGroup value={reason} onChange={setReason} className="space-y-2">
        {(Object.keys(FLAG_REASON) as FlagReason[]).map((r) => (
          <Radio
            key={r}
            value={r}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ring-1 ring-slate-200 data-[checked]:bg-red-50 data-[checked]:ring-2 data-[checked]:ring-red-500"
          >
            <span className="size-4 rounded-full ring-2 ring-slate-300 in-data-[checked]:bg-red-500 in-data-[checked]:ring-red-500" />
            <span className="text-sm font-semibold text-slate-700">{FLAG_REASON[r]}</span>
          </Radio>
        ))}
      </RadioGroup>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={300}
        rows={3}
        placeholder="Cuéntanos más (opcional)"
        className="mt-4 w-full rounded-lg border-slate-300 p-3 text-sm ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        onClick={() => mutate({ id: reportId, reason, comment })}
        disabled={isPending}
        className="mt-4 w-full rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? 'Enviando…' : 'Enviar denuncia'}
      </button>
    </Modal>
  )
}
