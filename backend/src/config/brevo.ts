/**
 * Envío transaccional con la API HTTP oficial de Brevo (v3): POST /v3/smtp/email.
 * Usa fetch nativo de Node (sin SDK adicional). La clave va solo en la cabecera `api-key`
 * y nunca se escribe en logs, respuestas ni errores.
 *
 * Variables: BREVO_API_KEY (secreta) y MAIL_FROM ("Nombre <correo>") como remitente,
 * que debe estar dado de alta y validado en Brevo (Remitentes, dominios e IP dedicadas).
 */

const API = 'https://api.brevo.com/v3'
const TIMEOUT_MS = 15_000

/** Motivos de fallo que la interfaz sabe explicar (no contienen datos sensibles) */
export type MailFailure =
  | 'not_configured'
  | 'invalid_key'
  | 'key_forbidden'
  | 'unauthorized_ip'
  | 'sender_not_verified'
  | 'no_credits'
  | 'rate_limited'
  | 'rejected'
  | 'unavailable'
  | 'network'

export class BrevoError extends Error {
  constructor(
    readonly reason: MailFailure,
    readonly status: number | null,
    readonly code: string | null,
    message: string,
  ) {
    super(message)
    this.name = 'BrevoError'
  }
}

export const brevoKey = () => (process.env.BREVO_API_KEY ?? '').trim()

/** Detecta errores de copiado frecuentes sin revelar la clave */
export function brevoKeyProblem(): string | null {
  const key = brevoKey()
  if (!key) return null
  if (key.startsWith('xkeysib-')) return null
  if (key.startsWith('xsmtpsib-')) return 'BREVO_API_KEY contiene una clave SMTP (xsmtpsib-…); se necesita una clave de API (xkeysib-…).'
  if (key.includes('xkeysib-')) return 'BREVO_API_KEY tiene texto antes de "xkeysib-" (¿se copió el nombre de la clave?). Deja solo el valor que empieza por xkeysib-.'
  return 'BREVO_API_KEY no tiene el formato de una clave de API de Brevo (debe empezar por xkeysib-).'
}

/** Quita la clave de cualquier texto antes de mostrarlo (defensa adicional) */
function redact(text: string) {
  const key = brevoKey()
  return key ? text.split(key).join('[BREVO_API_KEY]') : text
}

/** "GeoScript <no-reply@dominio.mx>" → { name, email } */
export function parseSender(from = process.env.MAIL_FROM ?? '') {
  const m = /^\s*"?([^"<]*?)"?\s*<\s*([^>\s]+)\s*>\s*$/.exec(from)
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim() }
  const email = from.trim()
  return email ? { email } : null
}

function classify(status: number, code: string | null, message: string): MailFailure {
  const text = `${code ?? ''} ${message}`.toLowerCase()
  if (status === 401 && /ip/.test(text) && /unrecogni[sz]ed|authori[sz]ed|not allowed/.test(text)) return 'unauthorized_ip'
  if (status === 403 && /not authori[sz]ed for resource|permission/.test(text)) return 'key_forbidden'
  if (status === 401 || code === 'unauthorized' || /key not found|api key/.test(text)) return 'invalid_key'
  if (/sender/.test(text) && /(not|in)\s?valid|not verified|not active|not allowed/.test(text)) return 'sender_not_verified'
  if (status === 402 || code === 'not_enough_credits' || /credit/.test(text)) return 'no_credits'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'unavailable'
  return 'rejected'
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const key = brevoKey()
  if (!key) throw new BrevoError('not_configured', null, null, 'BREVO_API_KEY no está definida')
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { 'api-key': key, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const e = error as { name?: string; message?: string }
    const what = e.name === 'TimeoutError' ? `sin respuesta en ${TIMEOUT_MS / 1000} s` : (e.message ?? 'error de red')
    throw new BrevoError('network', null, null, redact(`No se pudo conectar con Brevo (${what})`))
  }
  const text = await res.text()
  let data: Record<string, unknown> = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    /* respuesta no JSON (p. ej. página de error de un proxy) */
  }
  if (!res.ok) {
    const code = typeof data.code === 'string' ? data.code : null
    const message = typeof data.message === 'string' ? data.message : `HTTP ${res.status}`
    throw new BrevoError(classify(res.status, code, message), res.status, code, redact(message).slice(0, 300))
  }
  return data as T
}

/** Envía un correo transaccional. Devuelve el messageId que asigna Brevo */
export async function sendBrevoEmail(mail: { to: string; toName?: string; subject: string; html: string; tags?: string[] }) {
  const sender = parseSender()
  if (!sender) throw new BrevoError('not_configured', null, null, 'MAIL_FROM no está definida')
  const data = await request<{ messageId?: string }>('POST', '/smtp/email', {
    sender,
    to: [{ email: mail.to, ...(mail.toName ? { name: mail.toName } : {}) }],
    subject: mail.subject,
    htmlContent: mail.html,
    ...(mail.tags?.length ? { tags: mail.tags } : {}),
  })
  return data.messageId ?? null
}

type Sender = { id: number; name: string; email: string; active: boolean }

/**
 * Diagnóstico sin enviar nada: la clave es válida y el remitente de MAIL_FROM está
 * registrado y activo (validado) en la cuenta de Brevo.
 */
export async function checkBrevo() {
  // Una clave con permisos restringidos puede no leer la cuenta: no es un error para enviar
  const optional = async <T>(path: string, fallback: T) => {
    try {
      return { data: await request<T>('GET', path), forbidden: false }
    } catch (error) {
      if (error instanceof BrevoError && error.reason === 'key_forbidden') return { data: fallback, forbidden: true }
      throw error
    }
  }
  const account = await optional<{ email?: string; plan?: { type?: string; credits?: number; creditsType?: string }[] }>('/account', {})
  const senders = await optional<{ senders?: Sender[] }>('/senders', {})
  const list = senders.data.senders ?? []
  const from = parseSender()
  const match = from ? list.find((s) => s.email.toLowerCase() === from.email.toLowerCase()) : undefined
  return {
    accountEmail: account.data.email ?? null,
    accountReadable: !account.forbidden,
    sendersReadable: !senders.forbidden,
    plans: (account.data.plan ?? []).map((p) => ({ type: p.type, credits: p.credits, creditsType: p.creditsType })),
    sender: from?.email ?? null,
    senderRegistered: !!match,
    senderActive: !!match?.active,
    activeSenders: list.filter((s) => s.active).map((s) => s.email),
  }
}
