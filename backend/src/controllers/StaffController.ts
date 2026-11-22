import type { Request, Response } from 'express'
import { Op, fn, col, type WhereOptions } from 'sequelize'
import { db } from '../config/db'
import { mailStatus } from '../config/mailer'
import { User } from '../models/User'
import { Area } from '../models/Area'
import { Report } from '../models/Report'
import { ReportHistory } from '../models/ReportHistory'
import { AuditLog } from '../models/AuditLog'
import { Blacklist } from '../models/Blacklist'
import { OPEN_STATUSES, type Role } from '../models/constants'
import { AuthEmail, type Delivery } from '../emails/AuthEmail'
import type { MailFailure } from '../config/brevo'
import { hashPassword } from '../utils/auth'
import { audit } from '../utils/audit'
import { accountStatus, generateInvite, inviteTtlHours, unusablePassword } from '../utils/invitations'
import { releaseAssignments, setAssignee } from '../utils/reportStatus'

/**
 * Gestión de responsables (IAM interno de la plataforma, no de la nube).
 * Solo administradores (lo exige adminRouter). Reglas:
 * - El personal se da de alta por invitación: el administrador nunca conoce ni define la contraseña.
 * - Roles asignables: operativo (requiere un área municipal u organismo) y moderador.
 *   El rol de administrador no se asigna desde la API (evita escalar privilegios).
 * - Nadie modifica su propio rol ni se desactiva; nunca se desactiva al último admin activo.
 * - Desactivar no borra nada: conserva historial, reportes y auditoría.
 */

const STAFF_ROLES: Role[] = ['operativo', 'moderador', 'admin']
export const ASSIGNABLE_STAFF_ROLES = ['operativo', 'moderador'] as const
type AssignableRole = (typeof ASSIGNABLE_STAFF_ROLES)[number]

const ROLE_LABEL: Record<Role, string> = {
  ciudadano: 'Ciudadano',
  operativo: 'Personal operativo',
  moderador: 'Moderador',
  admin: 'Administrador',
}

const areaInclude = { model: Area, attributes: ['id', 'name', 'type', 'active'] }

/** Reportes abiertos con responsable directo, por persona */
async function openAssignedBy(ids: number[]) {
  if (!ids.length) return new Map<number, number>()
  const rows = (await Report.findAll({
    where: { assigneeId: ids, status: OPEN_STATUSES },
    attributes: ['assigneeId', [fn('COUNT', col('id')), 'total']],
    group: ['assigneeId'],
    raw: true,
  })) as unknown as { assigneeId: number; total: string }[]
  return new Map(rows.map((r) => [r.assigneeId, Number(r.total)]))
}

function serializeMember(u: User, openAssigned: number, viewer: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    area: u.area ? { id: u.area.id, name: u.area.name, type: u.area.type, active: u.area.active } : null,
    status: accountStatus(u),
    active: u.active,
    confirmed: u.confirmed,
    banned: u.banned,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastLoginAt: u.lastLoginAt,
    invitedAt: u.invitedAt,
    inviteExpiresAt: u.confirmed ? null : u.inviteExpiresAt,
    openAssigned,
    isSelf: u.id === viewer.id,
  }
}

/** Mensaje claro de por qué no salió una invitación (sin inventar que se envió) */
const PENDING = 'La cuenta queda con invitación pendiente; cuando se corrija, usa "Reenviar invitación".'

/** Qué impidió el envío, en lenguaje de quien administra (sin secretos ni detalles internos) */
const FAILURE_TEXT: Record<MailFailure, string> = {
  not_configured: '',
  invalid_key: 'Brevo rechazó la clave de API (BREVO_API_KEY no es válida, se revocó o no tiene permiso de envío).',
  key_forbidden: 'La clave de API de Brevo no tiene permiso para enviar correos transaccionales.',
  unauthorized_ip: 'Brevo bloqueó la petición porque la IP del servidor no está autorizada en la cuenta (Seguridad → IP autorizadas).',
  sender_not_verified: 'Brevo rechazó el remitente: el correo de MAIL_FROM no está validado en Brevo.',
  no_credits: 'La cuenta de Brevo no tiene créditos de envío disponibles.',
  rate_limited: 'Brevo limitó temporalmente los envíos por exceso de peticiones. Intenta de nuevo en unos minutos.',
  rejected: 'El proveedor de correo rechazó el mensaje.',
  unavailable: 'El servicio de correo no está disponible en este momento.',
  network: 'No se pudo conectar con el servicio de correo (red o tiempo de espera agotado).',
}

function inviteResult(delivery: Delivery) {
  const mail = mailStatus()
  if (delivery.sent) {
    return {
      sent: true,
      warning: mail.sandbox ? 'El correo está configurado con el sandbox de Mailtrap: el mensaje no llega a buzones reales.' : null,
    }
  }
  if (delivery.reason === 'not_configured') {
    return {
      sent: false,
      reason: `No se envió la invitación porque el correo no está configurado (faltan ${mail.missing.join(', ')} en el servidor). ${PENDING}`,
    }
  }
  return { sent: false, reason: `No se envió la invitación. ${FAILURE_TEXT[delivery.reason]} ${PENDING}` }
}

/** Crea un enlace nuevo (invalida el anterior), lo guarda como hash y envía el correo */
async function issueInvitation(req: Request, user: User) {
  const invite = generateInvite()
  await user.update({ inviteTokenHash: invite.hash, inviteExpiresAt: invite.expiresAt, invitedAt: invite.invitedAt, invitedById: req.user!.id })
  const area = user.areaId ? await Area.findByPk(user.areaId, { attributes: ['name'] }) : null
  const delivery = await AuthEmail.sendInvitation({
    name: user.name,
    email: user.email,
    token: invite.token,
    roleLabel: ROLE_LABEL[user.role],
    areaName: area?.name ?? null,
    hours: inviteTtlHours(),
  })
  await audit(req, {
    action: delivery.sent ? 'invitation.sent' : 'invitation.not_sent',
    targetType: 'user',
    targetId: user.id,
    details: {
      email: user.email,
      provider: delivery.provider,
      ...(delivery.sent ? { messageId: delivery.messageId } : { failure: delivery.reason }),
    },
  })
  return inviteResult(delivery)
}

/** El operativo necesita un área activa que lo atienda directamente (no una autoridad externa) */
async function validOperativoArea(areaId: unknown) {
  const area = await Area.findByPk(Number(areaId))
  if (!area || !area.active) return { error: 'Selecciona un área activa para el personal operativo' }
  if (area.type === 'externa') return { error: 'Las autoridades externas reciben reportes canalizados: el personal operativo debe pertenecer a un área municipal u organismo.' }
  return { area }
}

async function loadStaff(req: Request, res: Response) {
  const user = await User.findByPk(req.params.userId, { include: [areaInclude] })
  if (!user || !STAFF_ROLES.includes(user.role)) {
    res.status(404).json({ error: 'Responsable no encontrado' })
    return null
  }
  return user
}

export class StaffController {
  /** Configuración que la pantalla necesita para explicar el estado del correo */
  static async meta(_req: Request, res: Response) {
    res.json({ mail: mailStatus(), inviteTtlHours: inviteTtlHours(), assignableRoles: ASSIGNABLE_STAFF_ROLES })
  }

  /** ?q=&areaId=&role=&status=activo|pendiente|desactivado|suspendido */
  static async list(req: Request, res: Response) {
    const where: Record<string | symbol, unknown> = { role: req.query.role ? req.query.role : STAFF_ROLES }
    if (req.query.areaId) where.areaId = Number(req.query.areaId)
    if (req.query.q) {
      const q = `%${req.query.q}%`
      where[Op.or] = [{ name: { [Op.iLike]: q } }, { email: { [Op.iLike]: q } }]
    }
    const byStatus: Record<string, Record<string, unknown>> = {
      activo: { active: true, banned: false, confirmed: true },
      pendiente: { active: true, confirmed: false },
      desactivado: { active: false },
      suspendido: { active: true, banned: true },
    }
    Object.assign(where, byStatus[String(req.query.status)] ?? {})

    const users = await User.findAll({
      where: where as WhereOptions,
      include: [areaInclude],
      order: [['active', 'DESC'], ['name', 'ASC']],
      limit: 300,
    })
    const open = await openAssignedBy(users.map((u) => u.id))
    res.json(users.map((u) => serializeMember(u, open.get(u.id) ?? 0, req.user!)))
  }

  static async get(req: Request, res: Response) {
    const user = await loadStaff(req, res)
    if (!user) return
    const [open, invitedBy, areaOpen] = await Promise.all([
      openAssignedBy([user.id]),
      user.invitedById ? User.findByPk(user.invitedById, { attributes: ['id', 'name'] }) : null,
      user.areaId ? Report.count({ where: { areaId: user.areaId, status: OPEN_STATUSES } }) : 0,
    ])
    const assigned = await Report.findAll({
      where: { assigneeId: user.id, status: OPEN_STATUSES },
      attributes: ['id', 'title', 'status', 'severity', 'areaId', 'createdAt'],
      order: [['createdAt', 'ASC']],
      limit: 50,
    })
    res.json({
      ...serializeMember(user, open.get(user.id) ?? 0, req.user!),
      invitedBy: invitedBy ? { id: invitedBy.id, name: invitedBy.name } : null,
      areaOpenReports: areaOpen,
      assignedReports: assigned.map((r) => r.toJSON()),
    })
  }

  /** Alta de un responsable con invitación por correo */
  static async create(req: Request, res: Response) {
    const email = String(req.body.email).toLowerCase()
    const role = req.body.role as AssignableRole

    const existing = await User.findOne({ where: { email }, attributes: ['id', 'role'] })
    if (existing) {
      res.status(409).json({
        error:
          existing.role === 'ciudadano'
            ? 'Ese correo ya tiene una cuenta de ciudadano. Para convertirla en personal, cambia su rol desde Usuarios.'
            : 'Ya existe una cuenta del personal con ese correo.',
        code: 'EMAIL_EXISTS',
        existingRole: existing.role,
      })
      return
    }
    if (await Blacklist.findOne({ where: { email } })) {
      res.status(409).json({ error: 'Ese correo está en la lista de correos vetados.', code: 'BLACKLISTED' })
      return
    }

    let areaId: number | null = null
    if (role === 'operativo') {
      const check = await validOperativoArea(req.body.areaId)
      if (check.error) {
        res.status(400).json({ error: check.error })
        return
      }
      areaId = check.area!.id
    }

    const user = await db.transaction(async (t) => {
      const created = await User.create(
        {
          name: req.body.name,
          email,
          // Nadie conoce este password: la persona define el suyo al aceptar la invitación
          password: await hashPassword(unusablePassword()),
          role,
          areaId,
          confirmed: false,
          active: true,
          invitedById: req.user!.id,
        },
        { transaction: t },
      )
      await audit(req, { action: 'staff.created', targetType: 'user', targetId: created.id, details: { email, role, areaId } }, t)
      return created
    })

    const invitation = await issueInvitation(req, user)
    await user.reload({ include: [areaInclude] })
    res.status(201).json({ member: serializeMember(user, 0, req.user!), invitation })
  }

  /** Editar nombre, rol, área (y correo solo mientras la invitación está pendiente) */
  static async update(req: Request, res: Response) {
    const user = await loadStaff(req, res)
    if (!user) return
    const self = user.id === req.user!.id
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    const data: Record<string, unknown> = {}

    if (req.body.name !== undefined && req.body.name !== user.name) {
      changes.name = { from: user.name, to: req.body.name }
      data.name = req.body.name
    }

    let emailChanged = false
    if (req.body.email !== undefined && String(req.body.email).toLowerCase() !== user.email) {
      // Cambiar el correo de una cuenta ya activa permitiría tomar el control de ella
      if (user.confirmed) {
        res.status(400).json({ error: 'El correo de una cuenta activa no se puede cambiar desde aquí. Si cambió, desactiva la cuenta y registra el nuevo correo.' })
        return
      }
      const email = String(req.body.email).toLowerCase()
      if (await User.findOne({ where: { email }, attributes: ['id'] })) {
        res.status(409).json({ error: 'Ya existe una cuenta con ese correo', code: 'EMAIL_EXISTS' })
        return
      }
      if (await Blacklist.findOne({ where: { email } })) {
        res.status(409).json({ error: 'Ese correo está en la lista de correos vetados.', code: 'BLACKLISTED' })
        return
      }
      changes.email = { from: user.email, to: email }
      data.email = email
      emailChanged = true
    }

    const wantsRole = req.body.role !== undefined && req.body.role !== user.role
    const wantsArea = req.body.areaId !== undefined && (req.body.areaId === null ? null : Number(req.body.areaId)) !== (user.areaId ?? null)
    if (wantsRole || wantsArea) {
      if (self) {
        res.status(403).json({ error: 'No puedes cambiar tu propio rol o área' })
        return
      }
      if (user.role === 'admin') {
        res.status(403).json({ error: 'El rol de un administrador no se cambia desde el panel' })
        return
      }
      const role = (wantsRole ? req.body.role : user.role) as AssignableRole
      let areaId: number | null = null
      if (role === 'operativo') {
        const check = await validOperativoArea(wantsArea ? req.body.areaId : user.areaId)
        if (check.error) {
          res.status(400).json({ error: check.error })
          return
        }
        areaId = check.area!.id
      }
      if (role !== user.role) changes.role = { from: user.role, to: role }
      if (areaId !== user.areaId) changes.areaId = { from: user.areaId, to: areaId }
      data.role = role
      data.areaId = areaId
    }

    if (!Object.keys(changes).length) {
      res.status(400).json({ error: 'No hay cambios que guardar' })
      return
    }

    let released = 0
    await db.transaction(async (t) => {
      // Sus reportes abiertos pertenecen al área anterior: vuelven a la bandeja general
      if (changes.role || changes.areaId) {
        released = await releaseAssignments(user.id, req.user!.id, changes.areaId ? 'el responsable cambió de área' : 'el responsable cambió de rol', t)
      }
      await user.update(data, { transaction: t })
      await audit(req, { action: 'staff.updated', targetType: 'user', targetId: user.id, details: { changes, releasedReports: released } }, t)
    })

    // Correo corregido antes de aceptar: el enlace anterior iba a otra dirección
    const invitation = emailChanged && user.active ? await issueInvitation(req, user) : null
    await user.reload({ include: [areaInclude] })
    const open = await openAssignedBy([user.id])
    res.json({ member: serializeMember(user, open.get(user.id) ?? 0, req.user!), releasedReports: released, invitation })
  }

  /** Activar / desactivar (no borra nada) */
  static async setActive(req: Request, res: Response) {
    const user = await loadStaff(req, res)
    if (!user) return
    const active = req.body.active === true
    if (user.id === req.user!.id) {
      res.status(403).json({ error: 'No puedes desactivar tu propia cuenta' })
      return
    }
    if (user.active === active) {
      res.status(400).json({ error: active ? 'La cuenta ya está activa' : 'La cuenta ya está desactivada' })
      return
    }

    let released = 0
    await db.transaction(async (t) => {
      if (!active) {
        // Bloqueo de fila: dos administradores desactivándose a la vez no dejan la plataforma sin admin
        if (user.role === 'admin') {
          await User.findAll({ where: { role: 'admin' }, attributes: ['id'], lock: t.LOCK.UPDATE, transaction: t })
          if ((await User.count({ where: { role: 'admin', active: true, banned: false, confirmed: true, id: { [Op.ne]: user.id } }, transaction: t })) === 0) {
            throw Object.assign(new Error('LAST_ADMIN'), { status: 409 })
          }
        }
        released = await releaseAssignments(user.id, req.user!.id, 'el responsable fue desactivado', t)
        // Un enlace de invitación pendiente deja de servir
        await user.update({ active: false, inviteTokenHash: null, inviteExpiresAt: null }, { transaction: t })
      } else {
        await user.update({ active: true }, { transaction: t })
      }
      await audit(req, { action: active ? 'staff.activated' : 'staff.deactivated', targetType: 'user', targetId: user.id, details: { releasedReports: released } }, t)
    }).catch((error: Error & { status?: number }) => {
      if (error.message !== 'LAST_ADMIN') throw error
      res.status(409).json({ error: 'No puedes desactivar al último administrador activo', code: 'LAST_ADMIN' })
    })
    if (res.headersSent) return

    await user.reload({ include: [areaInclude] })
    res.json({
      member: serializeMember(user, 0, req.user!),
      releasedReports: released,
      message: active
        ? `${user.name} puede volver a iniciar sesión`
        : `${user.name} ya no puede iniciar sesión${released ? `; ${released} reporte${released === 1 ? '' : 's'} volvieron a la bandeja de su área` : ''}`,
    })
  }

  /** Genera un enlace nuevo (el anterior deja de servir) y lo envía */
  static async resendInvitation(req: Request, res: Response) {
    const user = await loadStaff(req, res)
    if (!user) return
    if (user.confirmed) {
      res.status(400).json({ error: 'La cuenta ya está activa: no necesita invitación' })
      return
    }
    if (!user.active) {
      res.status(400).json({ error: 'Activa la cuenta antes de reenviar la invitación' })
      return
    }
    const invitation = await issueInvitation(req, user)
    await user.reload({ include: [areaInclude] })
    res.json({ member: serializeMember(user, 0, req.user!), invitation })
  }

  /**
   * Reasigna los reportes ABIERTOS de un responsable a otro de la misma área,
   * o los devuelve a la bandeja general del área (toUserId = null).
   */
  static async reassign(req: Request, res: Response) {
    const from = await loadStaff(req, res)
    if (!from) return
    const toUserId = req.body.toUserId === null ? null : Number(req.body.toUserId)
    const reports = await Report.findAll({ where: { assigneeId: from.id, status: OPEN_STATUSES } })
    if (!reports.length) {
      res.status(400).json({ error: `${from.name} no tiene reportes abiertos asignados` })
      return
    }

    let target: User | null = null
    if (toUserId !== null) {
      if (toUserId === from.id) {
        res.status(400).json({ error: 'Elige a otra persona' })
        return
      }
      target = await User.findByPk(toUserId)
      if (!target || target.role !== 'operativo' || !target.active || !target.confirmed || target.banned) {
        res.status(400).json({ error: 'El nuevo responsable debe ser personal operativo con la cuenta activa' })
        return
      }
      const otherArea = reports.filter((r) => r.areaId !== target!.areaId).length
      if (otherArea) {
        res.status(400).json({
          error: `${otherArea} de los reportes pertenece${otherArea === 1 ? '' : 'n'} a otra área. Elige a alguien de la misma área o devuélvelos a la bandeja general.`,
        })
        return
      }
    }

    await db.transaction(async (t) => {
      for (const report of reports) {
        await setAssignee(report, target ? { id: target.id, name: target.name } : null, req.user!.id, target ? 'Se reasignó a otro responsable del área' : 'El reporte volvió a la bandeja general del área', t)
      }
      await audit(req, { action: 'staff.reports_reassigned', targetType: 'user', targetId: from.id, details: { count: reports.length, toUserId } }, t)
    })
    res.json({
      message: target
        ? `${reports.length} reporte${reports.length === 1 ? '' : 's'} reasignado${reports.length === 1 ? '' : 's'} a ${target.name}`
        : `${reports.length} reporte${reports.length === 1 ? '' : 's'} volvieron a la bandeja general del área`,
    })
  }

  /** Historial: acciones administrativas sobre la cuenta y su trabajo reciente en reportes */
  static async activity(req: Request, res: Response) {
    const user = await loadStaff(req, res)
    if (!user) return
    const [logs, attention] = await Promise.all([
      AuditLog.findAll({
        where: { [Op.or]: [{ targetType: 'user', targetId: user.id }, { actorId: user.id }] },
        include: [{ model: User, as: 'actor', attributes: ['id', 'name'] }],
        order: [['createdAt', 'DESC']],
        limit: 50,
      }),
      ReportHistory.findAll({
        where: { changedById: user.id },
        include: [{ model: Report, attributes: ['id', 'title'], paranoid: false }],
        attributes: ['id', 'kind', 'fromStatus', 'toStatus', 'createdAt', 'reportId'],
        order: [['createdAt', 'DESC']],
        limit: 20,
      }),
    ])
    res.json({
      audit: logs.map((l) => ({
        id: l.id,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        details: l.details,
        createdAt: l.createdAt,
        actor: l.actor ? { id: l.actor.id, name: l.actor.name } : null,
      })),
      attention: attention.map((h) => ({
        id: h.id,
        kind: h.kind,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        createdAt: h.createdAt,
        report: h.report ? { id: h.report.id, title: h.report.title } : { id: h.reportId, title: null },
      })),
    })
  }
}
