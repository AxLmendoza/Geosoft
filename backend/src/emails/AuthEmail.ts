import { isSandboxSmtp, transporter } from '../config/mailer'

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
 * Envía el correo sin tumbar la petición si el SMTP falla.
 * Devuelve true si se envió. En desarrollo imprime el código en consola
 * para poder probar aunque el correo no llegue.
 */
async function send(user: EmailUser, subject: string, html: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`✉ [${subject}] código para ${user.email}: ${user.token}`)
    if (isSandboxSmtp()) console.log('  (SMTP sandbox de Mailtrap: el correo solo aparece en tu bandeja de Mailtrap)')
  }
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM, to: user.email, subject, html })
    return true
  } catch (error) {
    console.error(`✖ No se pudo enviar el correo a ${user.email}:`, error)
    return false
  }
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
    )
  }
}
