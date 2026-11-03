import type { Request, Response, NextFunction } from 'express'
import { User } from '../models/User'
import type { Role } from '../models/constants'
import { verifyJWT } from '../utils/auth'

declare global {
  namespace Express {
    interface Request {
      user?: User
    }
  }
}

async function userFromHeader(req: Request) {
  const bearer = req.headers.authorization
  if (!bearer?.startsWith('Bearer ')) return null
  const { id } = verifyJWT(bearer.split(' ')[1])
  return User.findByPk(id)
}

/** Requiere sesión válida, cuenta confirmada y usuario no baneado */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userFromHeader(req)
    if (!user) {
      res.status(401).json({ error: 'No autenticado' })
      return
    }
    if (!user.confirmed) {
      res.status(403).json({ error: 'Tu cuenta no ha sido confirmada', code: 'UNCONFIRMED' })
      return
    }
    if (user.banned) {
      res.status(403).json({ error: `Tu cuenta fue suspendida: ${user.bannedReason ?? ''}`.trim(), code: 'BANNED' })
      return
    }
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Token no válido' })
  }
}

/** Si viene token lo usa (para que moderadores vean autores), si no, sigue como anónimo */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await userFromHeader(req)
    if (user && user.confirmed && !user.banned) req.user = user
  } catch {
    /* token inválido: se trata como visitante */
  }
  next()
}

export const requireRole = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ error: 'No tienes permisos para esta acción' })
    return
  }
  next()
}
