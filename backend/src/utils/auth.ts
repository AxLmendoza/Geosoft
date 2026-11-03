import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { randomInt } from 'node:crypto'

export const hashPassword = (password: string) => bcrypt.hash(password, 10)

export const checkPassword = (password: string, hash: string) => bcrypt.compare(password, hash)

/** Código numérico de 6 dígitos + fecha de expiración */
export function generateToken() {
  const ttl = Number(process.env.TOKEN_TTL_MINUTES ?? 15)
  return {
    token: randomInt(100000, 1000000).toString(),
    tokenExpiresAt: new Date(Date.now() + ttl * 60 * 1000),
  }
}

export const isTokenExpired = (expiresAt: Date | null) => !expiresAt || expiresAt.getTime() < Date.now()

export function generateJWT(id: number) {
  return jwt.sign({ id }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  })
}

export function verifyJWT(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!) as { id: number }
}
