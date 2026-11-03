import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { EnvelopeOpenIcon } from '@heroicons/react/24/outline'
import { confirmAccount } from '@/api/AuthAPI'
import TokenInput from './TokenInput'

export default function ConfirmAccountView() {
  const [token, setToken] = useState('')
  const navigate = useNavigate()
  const email = (useLocation().state as { email?: string } | null)?.email

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

  return (
    <>
      <EnvelopeOpenIcon className="mx-auto size-14 text-indigo-500" />
      <h1 className="mt-3 text-center text-2xl font-extrabold text-slate-900">Confirma tu cuenta</h1>
      <p className="mt-1 text-center text-sm text-slate-500">
        Ingresa el código de 6 dígitos que enviamos {email ? <>a <b>{email}</b></> : 'a tu correo'}. Caduca en pocos minutos.
      </p>

      <div className="mt-8">
        <TokenInput value={token} onChange={setToken} onComplete={(t) => mutate(t)} disabled={isPending} />
      </div>

      <nav className="mt-8 text-center text-sm">
        <Link to="/auth/request-code" state={{ email }} className="text-slate-600">
          ¿El código expiró? <b className="text-indigo-600">Solicitar uno nuevo</b>
        </Link>
      </nav>
    </>
  )
}
