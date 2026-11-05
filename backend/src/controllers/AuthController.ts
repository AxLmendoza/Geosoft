import type { Request, Response } from 'express'
import { User } from '../models/User'
import { Blacklist } from '../models/Blacklist'
import { AuthEmail } from '../emails/AuthEmail'
import { checkPassword, generateJWT, generateToken, hashPassword, isTokenExpired } from '../utils/auth'
import { clearFailures, registerFailure } from '../utils/codeAttempts'

const INVALID_CODE = 'Código no válido o expirado'

/**
 * Busca al usuario por CORREO + código vigente.
 * Antes se buscaba solo por el código: con muchos códigos activos, adivinar 6 dígitos
 * podía coincidir con el de otra persona. Ahora el código solo sirve para su correo
 * y tras varios intentos fallidos se invalida.
 */
async function findByValidToken(emailInput: string, token: string) {
  const email = String(emailInput).toLowerCase()
  const user = await User.scope('withSecrets').findOne({ where: { email } })
  const valid = !!user && user.token === token && !isTokenExpired(user.tokenExpiresAt)
  if (valid) {
    clearFailures(email)
    return user
  }
  if (user?.token && registerFailure(email)) {
    await user.update({ token: null, tokenExpiresAt: null })
  }
  return null
}

export class AuthController {
  static async createAccount(req: Request, res: Response) {
    const email = String(req.body.email).toLowerCase()

    if (await Blacklist.findOne({ where: { email } })) {
      res.status(403).json({ error: 'Este correo no puede registrarse en la plataforma' })
      return
    }
    if (await User.findOne({ where: { email } })) {
      res.status(409).json({ error: 'Ya existe una cuenta con ese correo' })
      return
    }

    const { token, tokenExpiresAt } = generateToken()
    const user = await User.create({
      name: req.body.name,
      email,
      password: await hashPassword(req.body.password),
      token,
      tokenExpiresAt,
    })
    const sent = await AuthEmail.sendConfirmationEmail({ name: user.name, email: user.email, token })
    // La cuenta ya existe: aunque falle el correo respondemos 201 para que pueda pedir otro código
    res.status(201).json({
      message: sent ? 'Cuenta creada, revisa tu correo para confirmarla' : `Cuenta creada. ${'No pudimos enviar el correo. Intenta solicitar un código nuevo en unos minutos'}`,
    })
  }

  static async confirmAccount(req: Request, res: Response) {
    const user = await findByValidToken(req.body.email, req.body.token)
    if (!user || user.confirmed) {
      res.status(401).json({ error: INVALID_CODE })
      return
    }
    await user.update({ confirmed: true, token: null, tokenExpiresAt: null })
    res.json({ message: 'Cuenta confirmada, ya puedes iniciar sesión' })
  }

  /** Reenvía un código nuevo (el anterior queda invalidado) */
  static async requestConfirmationCode(req: Request, res: Response) {
    const user = await User.findOne({ where: { email: String(req.body.email).toLowerCase() } })
    if (!user) {
      res.status(404).json({ error: 'El usuario no existe' })
      return
    }
    if (user.confirmed) {
      res.status(409).json({ error: 'La cuenta ya está confirmada' })
      return
    }
    const { token, tokenExpiresAt } = generateToken()
    await user.update({ token, tokenExpiresAt })
    if (!(await AuthEmail.sendConfirmationEmail({ name: user.name, email: user.email, token }))) {
      res.status(502).json({ error: 'No pudimos enviar el correo. Intenta solicitar un código nuevo en unos minutos' })
      return
    }
    res.json({ message: 'Te enviamos un nuevo código a tu correo' })
  }

  static async login(req: Request, res: Response) {
    const email = String(req.body.email).toLowerCase()
    const user = await User.scope('withSecrets').findOne({ where: { email } })

    if (!user || !(await checkPassword(req.body.password, user.password))) {
      res.status(401).json({ error: 'Correo o password incorrectos' })
      return
    }
    if (user.banned || (await Blacklist.findOne({ where: { email } }))) {
      res.status(403).json({ error: 'Tu cuenta fue suspendida por moderación', code: 'BANNED' })
      return
    }
    if (!user.confirmed) {
      // Si el código ya caducó, se genera y envía otro automáticamente
      if (isTokenExpired(user.tokenExpiresAt)) {
        const { token, tokenExpiresAt } = generateToken()
        await user.update({ token, tokenExpiresAt })
        await AuthEmail.sendConfirmationEmail({ name: user.name, email: user.email, token })
      }
      res.status(403).json({
        error: 'Tu cuenta no ha sido confirmada. Revisa tu correo e ingresa el código',
        code: 'UNCONFIRMED',
      })
      return
    }
    res.json({ token: generateJWT(user.id) })
  }

  static async forgotPassword(req: Request, res: Response) {
    const user = await User.findOne({ where: { email: String(req.body.email).toLowerCase() } })
    // Misma respuesta exista o no la cuenta: no revela qué correos están registrados
    if (!user) {
      res.json({ message: 'Si el correo está registrado, te enviamos un código' })
      return
    }
    const { token, tokenExpiresAt } = generateToken()
    await user.update({ token, tokenExpiresAt })
    if (!(await AuthEmail.sendPasswordResetToken({ name: user.name, email: user.email, token }))) {
      res.status(502).json({ error: 'No pudimos enviar el correo. Intenta solicitar un código nuevo en unos minutos' })
      return
    }
    res.json({ message: 'Revisa tu correo para continuar' })
  }

  static async validateToken(req: Request, res: Response) {
    if (!(await findByValidToken(req.body.email, req.body.token))) {
      res.status(401).json({ error: INVALID_CODE })
      return
    }
    res.json({ message: 'Código válido, define tu nuevo password' })
  }

  static async resetPassword(req: Request, res: Response) {
    const user = await findByValidToken(req.body.email, req.params.token)
    if (!user) {
      res.status(401).json({ error: INVALID_CODE })
      return
    }
    await user.update({
      password: await hashPassword(req.body.password),
      token: null,
      tokenExpiresAt: null,
      confirmed: true, // si llegó al correo, el correo es suyo
    })
    res.json({ message: 'Password actualizado, ya puedes iniciar sesión' })
  }

  static async user(req: Request, res: Response) {
    res.json(req.user)
  }
}
