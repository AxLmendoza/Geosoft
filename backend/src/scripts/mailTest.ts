/**
 * Prueba de envío real con la misma configuración que la API:
 *   npm run mail:test -- destino@correo.com          (proveedor activo: Brevo si hay BREVO_API_KEY)
 *   npm run mail:test -- destino@correo.com --smtp   (fuerza el SMTP de respaldo)
 *   npm run mail:test -- --check                     (solo diagnóstico, no envía nada)
 * Nunca imprime la clave de API ni el contenido de los correos.
 */
import dotenv from 'dotenv'
dotenv.config()

import { checkMailer, isSandboxSmtp, mailProvider, transporter } from '../config/mailer'
import { brevoKeyProblem, checkBrevo, sendBrevoEmail } from '../config/brevo'

const HTML = '<p>Si recibiste este mensaje, el envío de correos de GeoScript está configurado correctamente.</p>'

async function main() {
  const args = process.argv.slice(2)
  const to = args.find((a) => !a.startsWith('--'))
  const forceSmtp = args.includes('--smtp')
  const provider = forceSmtp ? 'smtp' : mailProvider()

  if (args.includes('--check')) {
    if (provider !== 'brevo') return checkMailer()
    const problem = brevoKeyProblem()
    if (problem) console.warn(`⚠ ${problem}`)
    const r = await checkBrevo()
    console.log(`✔ Clave de Brevo aceptada${r.accountReadable ? ` (cuenta ${r.accountEmail ?? '¿?'})` : ' (sin permiso para leer la cuenta)'}`)
    for (const p of r.plans) console.log(`  plan ${p.type}: ${p.credits ?? '-'} ${p.creditsType ?? ''}`)
    if (!r.sendersReadable) {
      console.log(`  remitente MAIL_FROM: ${r.sender ?? '(vacío)'} → no verificable (la clave no puede leer los remitentes)`)
      return
    }
    console.log(`  remitente MAIL_FROM: ${r.sender ?? '(vacío)'} → ${r.senderActive ? 'validado' : r.senderRegistered ? 'registrado SIN validar' : 'NO registrado'}`)
    if (!r.senderActive) console.log(`  remitentes validados en la cuenta: ${r.activeSenders.join(', ') || 'ninguno'}`)
    return
  }

  if (!to || !/\S+@\S+\.\S+/.test(to)) {
    console.log('Uso: npm run mail:test -- destino@correo.com [--smtp] | --check')
    process.exit(1)
  }
  const subject = 'GeoScript - Prueba de correo'
  if (provider === 'brevo') {
    const id = await sendBrevoEmail({ to, subject, html: HTML, tags: ['geoscript', 'prueba'] })
    console.log(`✔ Brevo aceptó el envío (messageId ${id ?? '¿?'})`)
    return
  }
  await checkMailer()
  const info = await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html: HTML })
  console.log(`✔ Enviado por SMTP (${info.messageId}). Respuesta del servidor: ${info.response}`)
  if (isSandboxSmtp()) console.log('⚠ Es el sandbox de Mailtrap: revisa la bandeja de Mailtrap, no el buzón real.')
}

main().catch((err) => {
  const e = err as { reason?: string; status?: number; message?: string }
  console.error(`✖ No se pudo completar${e.reason ? ` [${e.reason}${e.status ? ` ${e.status}` : ''}]` : ''}: ${e.message ?? err}`)
  process.exit(1)
})
