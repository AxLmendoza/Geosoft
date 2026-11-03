import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { login } from '@/api/AuthAPI'
import { TOKEN_KEY } from '@/lib/axios'
import ErrorMessage from '@/components/ui/ErrorMessage'
import type { LoginForm } from '@/types'

export default function LoginView() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { register, handleSubmit, getValues, formState: { errors } } = useForm<LoginForm>({
    defaultValues: { email: '', password: '' },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: login,
    onError: (error: Error & { code?: string }) => {
      toast.error(error.message)
      if (error.code === 'UNCONFIRMED') navigate('/auth/confirm-account', { state: { email: getValues('email') } })
    },
    onSuccess: async (token) => {
      localStorage.setItem(TOKEN_KEY, token)
      await queryClient.invalidateQueries({ queryKey: ['user'] })
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true })
    },
  })

  return (
    <>
      <h1 className="text-2xl font-extrabold text-slate-900">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-slate-500">Reporta fallas de tu colonia y dales seguimiento.</p>

      <form onSubmit={handleSubmit((data) => mutate(data))} className="mt-6 space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input id="email" type="email" autoComplete="email" className="input" placeholder="tu@correo.com"
            {...register('email', { required: 'El correo es obligatorio', pattern: { value: /\S+@\S+\.\S+/, message: 'Correo no válido' } })} />
          {errors.email && <ErrorMessage>{errors.email.message}</ErrorMessage>}
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" className="input" placeholder="••••••••"
            {...register('password', { required: 'El password es obligatorio' })} />
          {errors.password && <ErrorMessage>{errors.password.message}</ErrorMessage>}
        </div>
        <button type="submit" disabled={isPending} className="btn-primary w-full">
          {isPending ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </form>

      <nav className="mt-6 flex flex-col gap-2 text-center text-sm">
        <Link to="/auth/register" className="text-slate-600">¿No tienes cuenta? <b className="text-indigo-600">Crea una</b></Link>
        <Link to="/auth/forgot-password" className="text-slate-600">¿Olvidaste tu password? <b className="text-indigo-600">Restablecer</b></Link>
      </nav>
    </>
  )
}
