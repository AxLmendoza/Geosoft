import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { resetPassword, validateToken } from '@/api/AuthAPI'
import ErrorMessage from '@/components/ui/ErrorMessage'
import TokenInput from './TokenInput'
import type { NewPasswordForm } from '@/types'

export default function NewPasswordView() {
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [isValid, setIsValid] = useState(false)
  const { register, handleSubmit, watch, formState: { errors } } = useForm<NewPasswordForm>({
    defaultValues: { password: '', password_confirmation: '' },
  })

  const validate = useMutation({
    mutationFn: validateToken,
    onError: (e) => {
      toast.error(e.message)
      setToken('')
    },
    onSuccess: (msg) => {
      toast.success(msg)
      setIsValid(true)
    },
  })

  const reset = useMutation({
    mutationFn: resetPassword,
    onError: (e) => toast.error(e.message),
    onSuccess: (msg) => {
      toast.success(msg)
      navigate('/auth/login')
    },
  })

  return (
    <>
      <h1 className="text-2xl font-extrabold text-slate-900">Nuevo password</h1>
      {!isValid ? (
        <>
          <p className="mt-1 text-sm text-slate-500">Ingresa el código que recibiste por correo.</p>
          <div className="mt-8">
            <TokenInput value={token} onChange={setToken} onComplete={(t) => validate.mutate(t)} disabled={validate.isPending} />
          </div>
          <nav className="mt-8 text-center text-sm">
            <Link to="/auth/forgot-password" className="font-bold text-indigo-600">Solicitar un nuevo código</Link>
          </nav>
        </>
      ) : (
        <form onSubmit={handleSubmit((form) => reset.mutate({ token, form }))} className="mt-6 space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="password">Nuevo password</label>
            <input id="password" type="password" className="input" autoComplete="new-password"
              {...register('password', { required: 'El password es obligatorio', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })} />
            {errors.password && <ErrorMessage>{errors.password.message}</ErrorMessage>}
          </div>
          <div>
            <label className="label" htmlFor="password_confirmation">Repetir password</label>
            <input id="password_confirmation" type="password" className="input" autoComplete="new-password"
              {...register('password_confirmation', { validate: (v) => v === watch('password') || 'Los passwords no coinciden' })} />
            {errors.password_confirmation && <ErrorMessage>{errors.password_confirmation.message}</ErrorMessage>}
          </div>
          <button disabled={reset.isPending} className="btn-primary w-full">{reset.isPending ? 'Guardando…' : 'Guardar password'}</button>
        </form>
      )}
    </>
  )
}
