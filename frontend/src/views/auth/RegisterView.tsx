import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { createAccount } from '@/api/AuthAPI'
import ErrorMessage from '@/components/ui/ErrorMessage'
import type { RegisterForm } from '@/types'

export default function RegisterView() {
  const navigate = useNavigate()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>({
    defaultValues: { name: '', email: '', password: '', password_confirmation: '' },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: createAccount,
    onError: (e) => toast.error(e.message),
    onSuccess: (msg, vars) => {
      toast.success(msg)
      navigate('/auth/confirm-account', { state: { email: vars.email } })
    },
  })

  return (
    <>
      <h1 className="text-2xl font-extrabold text-slate-900">Crear cuenta</h1>
      <p className="mt-1 text-sm text-slate-500">Te enviaremos un código de 6 dígitos para confirmar tu correo.</p>

      <form onSubmit={handleSubmit((data) => mutate(data))} className="mt-6 space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="name">Nombre</label>
          <input id="name" className="input" autoComplete="name" placeholder="Tu nombre"
            {...register('name', { required: 'El nombre es obligatorio', maxLength: { value: 60, message: 'Máximo 60 caracteres' } })} />
          {errors.name && <ErrorMessage>{errors.name.message}</ErrorMessage>}
        </div>
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input id="email" type="email" className="input" autoComplete="email" placeholder="tu@correo.com"
            {...register('email', { required: 'El correo es obligatorio', pattern: { value: /\S+@\S+\.\S+/, message: 'Correo no válido' } })} />
          {errors.email && <ErrorMessage>{errors.email.message}</ErrorMessage>}
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" autoComplete="new-password" placeholder="Mínimo 8 caracteres"
            {...register('password', { required: 'El password es obligatorio', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })} />
          {errors.password && <ErrorMessage>{errors.password.message}</ErrorMessage>}
        </div>
        <div>
          <label className="label" htmlFor="password_confirmation">Repetir password</label>
          <input id="password_confirmation" type="password" className="input" autoComplete="new-password"
            {...register('password_confirmation', { validate: (v) => v === watch('password') || 'Los passwords no coinciden' })} />
          {errors.password_confirmation && <ErrorMessage>{errors.password_confirmation.message}</ErrorMessage>}
        </div>
        <button type="submit" disabled={isPending} className="btn-primary w-full">
          {isPending ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>

      <nav className="mt-6 text-center text-sm">
        <Link to="/auth/login" className="text-slate-600">¿Ya tienes cuenta? <b className="text-indigo-600">Inicia sesión</b></Link>
      </nav>
    </>
  )
}
