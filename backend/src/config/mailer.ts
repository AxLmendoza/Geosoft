import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
import { brevoKey, brevoKeyProblem, checkBrevo, type BrevoError } from './brevo'

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

/**
 * Proveedor de correo: si existe BREVO_API_KEY se usa la API HTTP de Brevo; si no, el SMTP
 * de siempre (SMTP_HOST, SMTP_USER, ...). La configuración SMTP se conserva como respaldo
 * y la sigue usando `npm run mail:test -- --smtp`.
 */
export type MailProvider = 'brevo' | 'smtp'
export const mailProvider = (): MailProvider => (brevoKey() ? 'brevo' : 'smtp')

const REQUIRED_MAIL_VARS: Record<MailProvider, string[]> = {
  brevo: ['BREVO_API_KEY', 'MAIL_FROM'],
  smtp: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'],
}

/**
 * Estado de la configuración de correo (sin revelar valores): lo usa el panel para explicar
 * por qué una invitación quedó pendiente. `sandbox` = Mailtrap de pruebas, no llega a buzones reales.
 */
export function mailStatus() {
  const provider = mailProvider()
  const missing = REQUIRED_MAIL_VARS[provider].filter((k) => !process.env[k]?.trim())
  const frontendUrl = (process.env.FRONTEND_URL ?? '').split(',')[0].trim()
  return {
    provider,
    configured: missing.length === 0,
    missing,
    sandbox: provider === 'smtp' && isSandboxSmtp(),
    /** Sin FRONTEND_URL el enlace de invitación no tendría a dónde llevar */
    frontendUrl: !!frontendUrl,
  }
}

const INVALID_FROM = /@[^>\s]*\.(local|test|example|invalid)(>|\s|$)/i

/**
 * Diagnóstico al arrancar (no bloquea): avisa de la configuración que impide
 * que los códigos lleguen al correo real del usuario.
 */
export async function checkMailer() {
  const { provider, missing } = mailStatus()
  if (missing.length) {
    console.warn(`⚠ Correo (${provider}): faltan variables ${missing.join(', ')}. Los correos no se podrán enviar.`)
    return
  }
  if (provider === 'brevo') {
    const problem = brevoKeyProblem()
    if (problem) console.warn(`⚠ Correo (Brevo): ${problem}`)
    try {
      const r = await checkBrevo()
      if (!r.sendersReadable) {
        console.log(`✔ Correo: API de Brevo configurada (la clave no puede leer los remitentes; ${r.sender} debe estar validado en Brevo)`)
      } else if (!r.senderRegistered) {
        console.warn(`⚠ Correo (Brevo): el remitente ${r.sender} de MAIL_FROM no está registrado en Brevo; los envíos serán rechazados.`)
      } else if (!r.senderActive) {
        console.warn(`⚠ Correo (Brevo): el remitente ${r.sender} está registrado pero sin validar; confírmalo en Brevo.`)
      } else {
        console.log(`✔ Correo: API de Brevo correcta, remitente ${r.sender} validado`)
      }
    } catch (error) {
      const e = error as BrevoError
      console.error(`✖ Correo (Brevo): ${e.reason ?? ''} ${e.status ?? ''} ${e.message}`)
    }
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
