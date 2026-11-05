import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { EnvelopeOpenIcon } from '@heroicons/react/24/outline'
import { confirmAccount } from '@/api/AuthAPI'
import TokenInput from './TokenInput'

const isEmail = (v: string) => /\S+@\S+\.\S+/.test(v)

export default function ConfirmAccountView() {
  const [token, setToken] = useState('')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // El correo llega desde el registro/login (state) o desde el enlace del correo (?email=)
  const known = (useLocation().state as { email?: string } | null)?.email ?? params.get('email') ?? ''
  const [email, setEmail] = useState(known)

  const { mutate, isPending } = useMutation({
    mutationFn: confirmAccount,
    onError: (e) => {
      toast.error(e.message)
      setToken('')
    },
    onSuccess: (msg) => {
      toast.success(msg)
      navigate('/auth/login')
    },
  })

  const submit = (code: string) => {
    if (!isEmail(email)) return toast.error('Escribe el correo con el que te registraste')
    mutate({ email: email.trim(), token: code })
  }

  return (
    <>
      <EnvelopeOpenIcon className="mx-auto size-14 text-indigo-500" />
      <h1 className="mt-3 text-center text-2xl font-extrabold text-slate-900">Confirma tu cuenta</h1>
      <p className="mt-1 text-center text-sm text-slate-500">
        Ingresa el código de 6 dígitos que enviamos {known ? <>a <b>{known}</b></> : 'a tu correo'}. Caduca en pocos minutos.
      </p>

      {!known && (
        <div className="mt-6">
          <label className="label" htmlFor="email">Correo</label>
          <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        </div>
      )}

      <div className="mt-8">
        <TokenInput value={token} onChange={setToken} onComplete={submit} disabled={isPending} />
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">¿No llega? Revisa también la carpeta de spam o correo no deseado.</p>

      <nav className="mt-6 text-center text-sm">
        <Link to="/auth/request-code" state={{ email }} className="text-slate-600">
          ¿El código expiró? <b className="text-indigo-600">Solicitar uno nuevo</b>
        </Link>
      </nav>
    </>
  )
}
