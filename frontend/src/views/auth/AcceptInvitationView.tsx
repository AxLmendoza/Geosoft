import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { acceptInvitation, validateInvitation } from '@/api/AuthAPI'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { Skeleton } from '@/components/ui/States'
import type { NewPasswordForm } from '@/types'

/**
 * El personal invitado crea su contraseña.
 * El token se lee una vez y se quita de la barra de direcciones (no queda en el historial
 * del navegador ni se comparte por accidente al copiar la URL).
 */
function readInviteFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return { email: params.get('email') ?? '', token: params.get('token') ?? '' }
}

export default function AcceptInvitationView() {
  const navigate = useNavigate()
  // Inicializador puro (StrictMode lo ejecuta dos veces); la URL se limpia en el efecto
  const [invite] = useState(readInviteFromUrl)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('token')) window.history.replaceState(window.history.state, '', window.location.pathname)
  }, [])
  const { register, handleSubmit, watch, formState: { errors } } = useForm<NewPasswordForm>({ defaultValues: { password: '', password_confirmation: '' } })

  const check = useMutation({ mutationFn: validateInvitation })
  const accept = useMutation({
    mutationFn: acceptInvitation,
    onSuccess: (msg) => {
      toast.success(msg)
      navigate('/auth/login', { replace: true })
    },
  })

  const complete = !!invite.email && !!invite.token
  useEffect(() => {
    if (complete) check.mutate(invite)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!complete || check.isError) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-slate-900">Enlace no válido</h1>
        <p className="mt-2 text-[15px] text-slate-600">
          {check.error?.message ?? 'El enlace de invitación está incompleto. Ábrelo directamente desde el correo que recibiste.'}
        </p>
        <p className="mt-2 text-[15px] text-slate-600">Si ya creaste tu contraseña, inicia sesión normalmente.</p>
        <Link to="/auth/login" className="btn-primary mt-6 w-full">Ir a iniciar sesión</Link>
      </>
    )
  }

  if (check.isPending || check.isIdle) {
    return (
      <div className="space-y-3" role="status" aria-label="Verificando la invitación">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Hola, {check.data?.name.split(' ')[0]}</h1>
      <p className="mt-1 text-[15px] text-slate-600">
        Crea la contraseña de tu cuenta del personal de GeoScript. Con ella entrarás con <b className="font-semibold text-slate-800">{invite.email}</b>.
      </p>

      <form onSubmit={handleSubmit((form) => accept.mutate({ ...invite, ...form }))} className="mt-6 space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input id="password" type="password" className="input" autoComplete="new-password" aria-describedby="pw-help" aria-invalid={!!errors.password}
            {...register('password', { required: 'Escribe una contraseña', minLength: { value: 8, message: 'Mínimo 8 caracteres' }, maxLength: { value: 72, message: 'Máximo 72 caracteres' } })} />
          <p id="pw-help" className="mt-1.5 text-sm text-slate-500">Al menos 8 caracteres. Usa una que no utilices en otros sitios.</p>
          {errors.password && <ErrorMessage>{errors.password.message}</ErrorMessage>}
        </div>
        <div>
          <label className="label" htmlFor="password_confirmation">Repite la contraseña</label>
          <input id="password_confirmation" type="password" className="input" autoComplete="new-password" aria-invalid={!!errors.password_confirmation}
            {...register('password_confirmation', { validate: (v) => v === watch('password') || 'Las contraseñas no coinciden' })} />
          {errors.password_confirmation && <ErrorMessage>{errors.password_confirmation.message}</ErrorMessage>}
        </div>
        {accept.isError && <ErrorMessage>{accept.error.message}</ErrorMessage>}
        <button type="submit" disabled={accept.isPending} className="btn-primary w-full">
          {accept.isPending ? 'Activando…' : 'Activar mi cuenta'}
        </button>
      </form>
    </>
  )
}
