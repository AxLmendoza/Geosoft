import { mailStatus, transporter, type MailProvider } from '../config/mailer'
import { BrevoError, sendBrevoEmail, type MailFailure } from '../config/brevo'

type EmailUser = { name: string; email: string; token: string }

/** El nombre lo escribe el usuario: se escapa para que no inyecte HTML en el correo */
const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const layout = (title: string, body: string) => `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
  <h2 style="color:#4338ca;margin-top:0">GeoScript</h2>
  <h3>${title}</h3>
  ${body}
  <p style="color:#6b7280;font-size:12px;margin-top:24px">Si tú no solicitaste esto, ignora este mensaje.</p>
</div>`

const codeBox = (token: string) =>
  `<p style="font-size:32px;letter-spacing:8px;font-weight:bold;background:#eef2ff;padding:12px;text-align:center;border-radius:8px">${token}</p>`

const ttl = () => process.env.TOKEN_TTL_MINUTES ?? '15'
const front = () => (process.env.FRONTEND_URL ?? '').split(',')[0]

/**
 * Los códigos NO se escriben en consola salvo que se pida explícitamente en desarrollo
 * (DEV_LOG_AUTH_CODES=true). Nunca en producción: los logs no deben contener secretos.
 */
const logCodes = () => process.env.NODE_ENV !== 'production' && process.env.DEV_LOG_AUTH_CODES === 'true'

/** Resultado de un envío: `reason` explica el fallo sin datos sensibles */
export type Delivery =
  | { sent: true; provider: MailProvider; messageId: string | null }
  | { sent: false; provider: MailProvider; reason: MailFailure; detail?: string }

/**
 * Envía sin tumbar la petición si el proveedor falla. Con BREVO_API_KEY usa la API de Brevo;
 * si no, el SMTP. El contenido (que puede llevar enlaces o códigos) nunca se escribe en logs.
 */
async function deliver(to: string, subject: string, html: string, tag: string, toName?: string): Promise<Delivery> {
  const status = mailStatus()
  const provider = status.provider
  if (!status.configured) {
    console.warn(`⚠ Correo no configurado (${provider}): no se envió "${subject}" (faltan ${status.missing.join(', ')})`)
    return { sent: false, provider, reason: 'not_configured' }
  }
  if (provider === 'brevo') {
    try {
      const messageId = await sendBrevoEmail({ to, toName, subject, html, tags: ['geoscript', tag] })
      return { sent: true, provider, messageId }
    } catch (error) {
      const e = error instanceof BrevoError ? error : new BrevoError('network', null, null, 'Error inesperado al llamar a Brevo')
      console.error(`✖ Brevo no envió "${subject}" [${e.reason}] ${e.status ?? ''} ${e.code ?? ''} ${e.message}`)
      return { sent: false, provider, reason: e.reason, detail: e.message }
    }
  }
  try {
    const info = await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html })
    return { sent: true, provider, messageId: info?.messageId ?? null }
  } catch (error) {
    const e = error as { code?: string; responseCode?: number; message?: string }
    console.error(`✖ No se pudo enviar "${subject}" (${e.code ?? ''} ${e.responseCode ?? ''}) ${e.message ?? ''}`)
    return { sent: false, provider, reason: 'rejected', detail: e.code }
  }
}

async function send(user: EmailUser, subject: string, html: string, tag: string) {
  if (logCodes()) {
    console.log(`✉ [${subject}] código para ${user.email}: ${user.token}`)
    if (mailStatus().sandbox) console.log('  (SMTP sandbox de Mailtrap: el correo solo aparece en tu bandeja de Mailtrap)')
  }
  return (await deliver(user.email, subject, html, tag, user.name)).sent
}

export class AuthEmail {
  static sendConfirmationEmail(user: EmailUser) {
    return send(
      user,
      'GeoScript - Confirma tu cuenta',
      layout(
        `Hola ${esc(user.name)}, confirma tu cuenta`,
        `<p>Ingresa este código en la aplicación. Caduca en <b>${ttl()} minutos</b>.</p>
         ${codeBox(user.token)}
         <p><a href="${front()}/auth/confirm-account?email=${encodeURIComponent(user.email)}">Ir a confirmar mi cuenta</a></p>`,
      ),
      'confirmacion',
    )
  }

  /**
   * Invitación del personal. El enlace contiene un token de un solo uso: NO se escribe
   * en consola en ningún entorno. Devuelve el resultado con el motivo si no se pudo enviar.
   */
  static sendInvitation(invite: { name: string; email: string; token: string; roleLabel: string; areaName: string | null; hours: number }): Promise<Delivery> {
    const link = `${front()}/auth/invitation?email=${encodeURIComponent(invite.email)}&token=${encodeURIComponent(invite.token)}`
    const where = invite.areaName ? ` en <b>${esc(invite.areaName)}</b>` : ''
    return deliver(
      invite.email,
      'GeoScript - Activa tu cuenta del personal',
      layout(
        `Hola ${esc(invite.name)}, te dieron de alta en GeoScript`,
        `<p>La administración municipal te registró como <b>${esc(invite.roleLabel)}</b>${where}.</p>
         <p>Para activar tu cuenta, crea tu contraseña con este enlace. Vence en <b>${invite.hours} horas</b> y solo se puede usar una vez.</p>
         <p style="text-align:center;margin:24px 0"><a href="${link}" style="background:#2556eb;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Crear mi contraseña</a></p>
         <p style="color:#6b7280;font-size:12px">Si el botón no funciona, copia este enlace en tu navegador:<br>${esc(link)}</p>`,
      ),
      'invitacion',
      invite.name,
    )
  }

  static sendPasswordResetToken(user: EmailUser) {
    return send(
      user,
      'GeoScript - Restablece tu password',
      layout(
        `Hola ${esc(user.name)}, restablece tu password`,
        `<p>Usa este código para crear un nuevo password. Caduca en <b>${ttl()} minutos</b>.</p>
         ${codeBox(user.token)}
         <p><a href="${front()}/auth/new-password?email=${encodeURIComponent(user.email)}">Restablecer password</a></p>`,
      ),
      'restablecer',
    )
  }
}
