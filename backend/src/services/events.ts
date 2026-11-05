import { createHmac } from 'node:crypto'
import type { Transaction } from 'sequelize'

/**
 * Eventos de la plataforma hacia un orquestador externo (n8n u otro) mediante webhook.
 *
 * Es OPCIONAL: si N8N_WEBHOOK_URL no está definida no se envía nada y la app funciona igual.
 * Nunca bloquea ni hace fallar la petición del usuario: se envía en segundo plano,
 * con tiempo límite, y los errores solo se registran en consola.
 *
 * Seguridad: cada envío lleva la cabecera X-GeoScript-Signature = HMAC-SHA256(body, N8N_WEBHOOK_SECRET)
 * para que el flujo de n8n verifique que la petición viene de la API.
 */

export type ReportEventName = 'report.created' | 'report.status_changed' | 'report.assigned' | 'report.updated'

const TIMEOUT_MS = 5000

export const webhooksEnabled = () => !!process.env.N8N_WEBHOOK_URL

export function signBody(body: string) {
  return createHmac('sha256', process.env.N8N_WEBHOOK_SECRET ?? '').update(body).digest('hex')
}

async function post(event: ReportEventName, reportId: number, extra: Record<string, unknown>) {
  // Import diferido: evita dependencias circulares (modelos ↔ utils)
  const { buildEventPayload } = await import('./eventPayload')
  const payload = await buildEventPayload(event, reportId, extra)
  if (!payload) return
  const body = JSON.stringify(payload)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(process.env.N8N_WEBHOOK_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GeoScript-Event': event,
        'X-GeoScript-Signature': signBody(body),
      },
      body,
      signal: controller.signal,
    })
    if (!res.ok) console.error(`✖ Webhook ${event} (#${reportId}) respondió ${res.status}`)
  } finally {
    clearTimeout(timer)
  }
}

/** Dispara el evento después de confirmar la transacción (o de inmediato si no hay) */
export function emitReportEvent(event: ReportEventName, reportId: number, extra: Record<string, unknown> = {}, transaction?: Transaction) {
  if (!webhooksEnabled()) return
  const fire = () => {
    post(event, reportId, extra).catch((err) => console.error(`✖ Webhook ${event} (#${reportId}) falló:`, err?.message ?? err))
  }
  if (transaction) transaction.afterCommit(fire)
  else fire()
}
