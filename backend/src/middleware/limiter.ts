import rateLimit from 'express-rate-limit'

const message = (msg: string) => ({ error: msg })

/** Límite general para toda la API */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Demasiadas peticiones, intenta más tarde'),
})

/**
 * Login, registro, códigos: más estricto contra fuerza bruta.
 * No cuenta GET /auth/user (la app lo consulta en cada carga y exige un JWT válido):
 * antes, abrir la app ~20 veces en 15 minutos bloqueaba la sesión aunque no hubiera intentos de login.
 * Sigue cubierta por apiLimiter.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
  message: message('Demasiados intentos, espera 15 minutos'),
})

/** Evita que un usuario inunde el mapa con reportes */
export const createReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user-${req.user.id}` : req.ip ?? 'anon'),
  message: message('Has alcanzado el límite de reportes por hora'),
})
