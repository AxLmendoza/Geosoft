import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

const port = Number(process.env.SMTP_PORT ?? 2525)

/**
 * OJO: el "sandbox" de Mailtrap NO entrega correos reales, solo los muestra
 * en su bandeja de pruebas. Para que lleguen al correo del usuario usa un SMTP
 * real (Gmail con contraseña de aplicación, Mailtrap Sending, Brevo, etc.).
 */
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  // 465 usa TLS directo; 587 / 2525 usan STARTTLS
  secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Sin esto, un SMTP caído deja la petición de registro colgada ~2 minutos
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
})

export const isSandboxSmtp = () => (process.env.SMTP_HOST ?? '').includes('sandbox.smtp.mailtrap.io')

const INVALID_FROM = /@[^>\s]*\.(local|test|example|invalid)(>|\s|$)/i

/**
 * Diagnóstico al arrancar (no bloquea): avisa de la configuración que impide
 * que los códigos lleguen al correo real del usuario.
 */
export async function checkMailer() {
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'].filter((k) => !process.env[k])
  if (missing.length) {
    console.warn(`⚠ Correo: faltan variables ${missing.join(', ')}. Los códigos no se podrán enviar.`)
    return
  }
  try {
    await transporter.verify()
    console.log(`✔ Correo: conexión SMTP correcta (${process.env.SMTP_HOST}:${port})`)
  } catch (error) {
    const e = error as { code?: string; responseCode?: number; message?: string }
    console.error(`✖ Correo: el servidor SMTP rechazó la conexión (${e.code ?? ''} ${e.responseCode ?? ''}) ${e.message ?? ''}`)
    return
  }
  if (isSandboxSmtp()) {
    console.warn('⚠ Correo: SMTP_HOST es el SANDBOX de Mailtrap. Los correos NO llegan a los buzones reales;')
    console.warn('  solo aparecen en la bandeja de pruebas de Mailtrap. Configura un SMTP real (ver .env.example).')
  }
  const from = process.env.MAIL_FROM ?? ''
  if (INVALID_FROM.test(from)) {
    console.warn(`⚠ Correo: MAIL_FROM (${from}) usa un dominio no válido; los proveedores reales lo rechazan o lo mandan a spam.`)
  }
}
