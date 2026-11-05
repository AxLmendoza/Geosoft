import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { addToBlacklist, getBlacklist, removeFromBlacklist } from '@/api/ModerationAPI'
import { formatDateTime } from '@/lib/date'
import ErrorMessage from '@/components/ui/ErrorMessage'

type Form = { email: string; reason: string }

export default function BlacklistPanel() {
  const queryClient = useQueryClient()
  const { data: list = [], isLoading } = useQuery({ queryKey: ['blacklist'], queryFn: getBlacklist })
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ defaultValues: { email: '', reason: '' } })

  const onDone = (msg: string) => {
    toast.success(msg)
    queryClient.invalidateQueries()
  }
  const add = useMutation({
    mutationFn: addToBlacklist,
    onError: (e) => toast.error(e.message),
    onSuccess: (msg) => {
      reset()
      onDone(msg)
    },
  })
  const remove = useMutation({ mutationFn: removeFromBlacklist, onError: (e) => toast.error(e.message), onSuccess: onDone })

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <form onSubmit={handleSubmit((d) => add.mutate(d))} className="card h-fit space-y-3" noValidate>
        <h3 className="font-bold text-slate-900">Vetar correo</h3>
        <p className="text-xs text-slate-500">El correo no podrá registrarse ni iniciar sesión. Si ya tiene cuenta, queda baneada.</p>
        <div>
          <input className="input" placeholder="correo@ejemplo.com" {...register('email', { required: 'Correo obligatorio', pattern: { value: /\S+@\S+\.\S+/, message: 'Correo no válido' } })} />
          {errors.email && <ErrorMessage>{errors.email.message}</ErrorMessage>}
        </div>
        <div>
          <textarea rows={3} className="input" placeholder="Motivo" {...register('reason', { required: 'Motivo obligatorio', minLength: { value: 5, message: 'Mínimo 5 caracteres' } })} />
          {errors.reason && <ErrorMessage>{errors.reason.message}</ErrorMessage>}
        </div>
        <button disabled={add.isPending} className="btn-primary w-full">
          Vetar correo
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl glass">
        {isLoading && <p className="p-6 text-slate-500">Cargando…</p>}
        {!isLoading && list.length === 0 && <p className="p-8 text-center text-slate-500">No hay correos vetados</p>}
        <ul className="divide-y divide-slate-100">
          {list.map((b) => (
            <li key={b.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">{b.email}</p>
                <p className="text-sm text-slate-600">{b.reason}</p>
                <p className="text-xs text-slate-400">
                  {formatDateTime(b.createdAt)}{b.createdBy && ` · por ${b.createdBy.name}`}
                </p>
              </div>
              <button
                onClick={() => confirm(`¿Quitar ${b.email} de la lista negra? También se desbanea su cuenta.`) && remove.mutate(b.id)}
                className="btn-secondary btn-compact shrink-0"
              >
                Quitar veto
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
