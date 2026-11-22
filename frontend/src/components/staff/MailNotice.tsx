import { ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/20/solid'
import type { StaffMeta } from '@/types'

/**
 * Explica por qué las invitaciones no llegan. No inventa envíos: si el correo no está
 * configurado lo dice y nombra las variables que faltan en el servidor.
 */
export default function MailNotice({ meta }: { meta?: StaffMeta }) {
  if (!meta) return null
  const { mail } = meta
  if (!mail.configured) {
    return (
      <div role="status" className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-inset ring-amber-300">
        <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
        <div>
          <p className="font-semibold">Las invitaciones no se pueden enviar todavía</p>
          <p className="mt-0.5">
            El servidor no tiene configurado el correo (faltan <span className="font-mono text-[13px]">{mail.missing.join(', ')}</span>).
            Puedes registrar responsables: sus cuentas quedarán con la invitación pendiente hasta que se configure el correo y la reenvíes.
          </p>
        </div>
      </div>
    )
  }
  if (mail.sandbox || !mail.frontendUrl) {
    return (
      <div role="status" className="flex gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-950 ring-1 ring-inset ring-brand-200">
        <InformationCircleIcon className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
        <p>
          {mail.sandbox
            ? 'El correo usa el entorno de pruebas de Mailtrap: las invitaciones no llegan a buzones reales.'
            : 'Falta FRONTEND_URL en el servidor: el enlace de la invitación no llevaría a la aplicación.'}
        </p>
      </div>
    )
  }
  return null
}
