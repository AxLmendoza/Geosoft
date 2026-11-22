import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Invitaciones del personal.
 * - El enlace lleva un token aleatorio de 32 bytes (no un código de 6 dígitos: no se puede adivinar).
 * - En la BD solo se guarda su hash SHA-256: si se filtra la tabla, los enlaces no sirven.
 * - El token nunca se escribe en logs ni se devuelve en la API: solo viaja en el correo.
 */
export const inviteTtlHours = () => {
  const n = Number(process.env.INVITE_TTL_HOURS ?? 72)
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 24 * 14) : 72
}

export const hashInviteToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function generateInvite() {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    hash: hashInviteToken(token),
    expiresAt: new Date(Date.now() + inviteTtlHours() * 3600 * 1000),
    invitedAt: new Date(),
  }
}

/** Comparación en tiempo constante del token recibido contra el hash guardado */
export function inviteMatches(token: string, storedHash: string | null) {
  if (!storedHash || !token) return false
  const a = Buffer.from(hashInviteToken(token), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Password inutilizable para cuentas que aún no aceptan su invitación (nadie lo conoce) */
export const unusablePassword = () => randomBytes(48).toString('base64url')

/** Estado de la cuenta para el panel */
export type AccountStatus = 'activo' | 'invitacion_pendiente' | 'invitacion_vencida' | 'sin_confirmar' | 'desactivado' | 'suspendido'

export function accountStatus(u: {
  active: boolean
  banned: boolean
  confirmed: boolean
  inviteTokenHash?: string | null
  inviteExpiresAt: Date | null
  invitedAt: Date | null
}): AccountStatus {
  if (!u.active) return 'desactivado'
  if (u.banned) return 'suspendido'
  if (!u.confirmed) {
    if (!u.invitedAt) return 'sin_confirmar'
    const expired = !u.inviteExpiresAt || new Date(u.inviteExpiresAt).getTime() < Date.now()
    return expired ? 'invitacion_vencida' : 'invitacion_pendiente'
  }
  return 'activo'
}
