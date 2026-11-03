import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Checkbox, Field, Label } from '@headlessui/react'
import { CheckIcon, NoSymbolIcon } from '@heroicons/react/24/solid'
import { toast } from 'react-toastify'
import Modal from '@/components/ui/Modal'
import { banUser } from '@/api/ModerationAPI'

type Props = { user: { id: number; name: string; email?: string } | null; onClose: () => void }

export default function BanDialog({ user, onClose }: Props) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [hideReports, setHideReports] = useState(true)

  const { mutate, isPending } = useMutation({
    mutationFn: banUser,
    onError: (e) => toast.error(e.message),
    onSuccess: (msg) => {
      toast.success(msg)
      queryClient.invalidateQueries()
      setReason('')
      onClose()
    },
  })

  return (
    <Modal open={!!user} onClose={onClose} title="Banear usuario">
      {user && (
        <div className="space-y-4">
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <b>{user.name}</b> {user.email && <>({user.email})</>} no podrá iniciar sesión y su correo entrará a la lista negra.
          </p>
          <div>
            <label className="label" htmlFor="ban-reason">Motivo</label>
            <textarea id="ban-reason" rows={3} className="input" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Publica imágenes no aptas / información falsa reiterada" maxLength={300} />
          </div>
          <Field className="flex items-center gap-2">
            <Checkbox
              checked={hideReports}
              onChange={setHideReports}
              className="group flex size-5 items-center justify-center rounded bg-white ring-1 ring-slate-300 data-[checked]:bg-red-600 data-[checked]:ring-red-600"
            >
              <CheckIcon className="hidden size-4 text-white group-data-[checked]:block" />
            </Checkbox>
            <Label className="text-sm text-slate-700">Ocultar todos sus reportes del mapa</Label>
          </Field>
          <button
            disabled={isPending || reason.trim().length < 5}
            onClick={() => mutate({ id: user.id, reason: reason.trim(), hideReports })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-40"
          >
            <NoSymbolIcon className="size-5" /> {isPending ? 'Baneando…' : 'Banear'}
          </button>
        </div>
      )}
    </Modal>
  )
}
