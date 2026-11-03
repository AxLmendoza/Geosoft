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
})

export const isSandboxSmtp = () => (process.env.SMTP_HOST ?? '').includes('sandbox.smtp.mailtrap.io')
