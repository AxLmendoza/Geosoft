import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { requestConfirmationCode } from '@/api/AuthAPI'
import ErrorMessage from '@/components/ui/ErrorMessage'

export default function RequestCodeView() {
  const navigate = useNavigate()
  const initialEmail = (useLocation().state as { email?: string } | null)?.email ?? ''
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { email: initialEmail } })

  const { mutate, isPending } = useMutation({
    mutationFn: requestConfirmationCode,
    onError: (e) => toast.error(e.message),
    onSuccess: (msg, email) => {
      toast.success(msg)
      navigate('/auth/confirm-account', { state: { email } })
    },
  })

  return (
    <>
      <h1 className="text-2xl font-extrabold text-slate-900">Nuevo código</h1>
      <p className="mt-1 text-sm text-slate-500">Escribe tu correo y te enviaremos otro código de confirmación.</p>
      <form onSubmit={handleSubmit(({ email }) => mutate(email))} className="mt-6 space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input id="email" type="email" className="input"
            {...register('email', { required: 'El correo es obligatorio', pattern: { value: /\S+@\S+\.\S+/, message: 'Correo no válido' } })} />
          {errors.email && <ErrorMessage>{errors.email.message}</ErrorMessage>}
        </div>
        <button disabled={isPending} className="btn-primary w-full">{isPending ? 'Enviando…' : 'Enviar código'}</button>
      </form>
      <nav className="mt-6 text-center text-sm">
        <Link to="/auth/login" className="font-bold text-indigo-600">Volver a iniciar sesión</Link>
      </nav>
    </>
  )
}
