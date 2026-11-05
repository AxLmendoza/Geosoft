/**
 * Intentos fallidos de código por correo (en memoria).
 * Tras MAX_ATTEMPTS fallos el código se invalida y hay que pedir uno nuevo,
 * así no se puede adivinar un código de 6 dígitos aunque se cambie de IP.
 * Nota: en memoria es suficiente para una sola instancia; con varias réplicas
 * convendría guardarlo en la BD o en Redis.
 */
const MAX_ATTEMPTS = 5
const WINDOW_MS = 30 * 60 * 1000

const attempts = new Map<string, { count: number; until: number }>()

/** Registra un fallo. Devuelve true si ya se alcanzó el límite */
export function registerFailure(email: string) {
  const now = Date.now()
  const entry = attempts.get(email)
  const count = entry && entry.until > now ? entry.count + 1 : 1
  attempts.set(email, { count, until: now + WINDOW_MS })
  // Limpieza ocasional para que el mapa no crezca indefinidamente
  if (attempts.size > 5000) for (const [k, v] of attempts) if (v.until < now) attempts.delete(k)
  return count >= MAX_ATTEMPTS
}

export const clearFailures = (email: string) => attempts.delete(email)
