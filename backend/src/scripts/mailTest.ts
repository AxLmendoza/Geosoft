/**
 * Prueba de envío real: npm run mail:test -- destino@correo.com
 * Usa la misma configuración SMTP que la API. Útil para confirmar el proveedor
 * antes de probar el registro.
 */
import dotenv from 'dotenv'
dotenv.config()

import { checkMailer, isSandboxSmtp, transporter } from '../config/mailer'

async function main() {
  const to = process.argv[2]
  if (!to || !/\S+@\S+\.\S+/.test(to)) {
    console.log('Uso: npm run mail:test -- destino@correo.com')
    process.exit(1)
  }
  await checkMailer()
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: 'GeoScript - Prueba de correo',
    html: '<p>Si recibiste este mensaje, el envío de códigos de GeoScript está configurado correctamente.</p>',
  })
  console.log(`✔ Enviado (${info.messageId}). Respuesta del servidor: ${info.response}`)
  if (isSandboxSmtp()) console.log('⚠ Es el sandbox de Mailtrap: revisa la bandeja de Mailtrap, no el buzón real.')
}

main().catch((err) => {
  console.error('✖ No se pudo enviar:', err?.message ?? err)
  process.exit(1)
})
