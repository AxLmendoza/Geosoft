import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { db } from '../config/db'
import { Report } from '../models/Report'
import { ReportFlag } from '../models/ReportFlag'
import { User } from '../models/User'
import { Blacklist } from '../models/Blacklist'
import { serializeReport } from '../utils/serializers'
import { buildReportFilters, reportIncludes, serializeMany } from './ReportController'
import { changeStatus } from '../utils/reportStatus'

/** Un moderador solo puede sancionar ciudadanos; el admin a cualquiera menos a otro admin */
function canSanction(actor: User, target: User) {
  if (actor.id === target.id || target.role === 'admin') return false
  if (actor.role === 'admin') return true
  return target.role === 'ciudadano'
}

export class ModerationController {
  // ---------- Denuncias ----------
  static async getFlags(req: Request, res: Response) {
    const flags = await ReportFlag.findAll({
      where: { status: (req.query.status as string) ?? 'pendiente' },
      include: [
        { model: User, as: 'reporter', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'reviewedBy', attributes: ['id', 'name'] },
        { model: Report, include: reportIncludes },
      ],
      order: [['createdAt', 'DESC']],
      limit: 200,
    })
    res.json(
      flags.map((f) => {
        const json = f.toJSON() as any
        json.report = f.report ? serializeReport(f.report, req.user) : null
        return json
      }),
    )
  }

  /** status: procedente | descartada. Si es procedente se puede ocultar el reporte */
  static async reviewFlag(req: Request, res: Response) {
    const flag = await ReportFlag.findByPk(req.params.flagId, { include: [Report] })
    if (!flag) {
      res.status(404).json({ error: 'Denuncia no encontrada' })
      return
    }
    await db.transaction(async (t) => {
      // Se resuelven todas las denuncias pendientes del mismo reporte a la vez
      await ReportFlag.update(
        { status: req.body.status, reviewedById: req.user!.id },
        { where: { reportId: flag.reportId, status: 'pendiente' }, transaction: t },
      )
      if (req.body.status === 'procedente' && req.body.hideReport) {
        await flag.report.update({ hidden: true, hiddenReason: `Denuncia procedente: ${flag.reason}` }, { transaction: t })
      }
      if (req.body.status === 'descartada' && flag.report.hidden && flag.report.hiddenReason?.startsWith('Oculto automáticamente')) {
        await flag.report.update({ hidden: false, hiddenReason: null }, { transaction: t })
      }
    })
    res.json({ message: 'Denuncia revisada' })
  }

  // ---------- Reportes ----------
  /**
   * ?status= &hidden=true|false &deleted=true (borrados lógicos)
   * &community=solucionado (la comunidad dice que ya quedó: más 👏 que "sigue igual")
   */
  static async getReports(req: Request, res: Response) {
    const deleted = req.query.deleted === 'true'
    const where: Record<string, any> = { ...buildReportFilters(req.query) }
    if (req.query.hidden === 'true') where.hidden = true
    if (req.query.hidden === 'false') where.hidden = false
    if (deleted) where.deletedAt = { [Op.ne]: null }

    const reports = await Report.findAll({
      where,
      paranoid: !deleted,
      include: [...reportIncludes, { model: ReportFlag, attributes: ['id', 'status', 'reason'] }],
      order: [['createdAt', 'DESC']],
      limit: 300,
    })
    let list = await serializeMany(reports, req.user)
    if (req.query.community === 'solucionado') {
      list = list
        .filter((r) => r.votes.solucionado > 0 && r.votes.solucionado > r.votes.sin_solucion && !['resuelto', 'rechazado'].includes(r.status))
        .sort((a, b) => b.votes.solucionado - a.votes.solucionado)
    }
    res.json(list)
  }

  static async updateStatus(req: Request, res: Response) {
    const report = await Report.findByPk(req.params.reportId)
    if (!report) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    if (report.status === req.body.status) {
      res.status(400).json({ error: 'El reporte ya tiene ese estado' })
      return
    }
    await changeStatus(report, req.body.status, req.user!.id, req.body.note)
    res.json({ message: 'Estado actualizado' })
  }

  static async setVisibility(req: Request, res: Response) {
    const report = await Report.findByPk(req.params.reportId)
    if (!report) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    await report.update({ hidden: req.body.hidden, hiddenReason: req.body.hidden ? req.body.reason || 'Contenido no apto' : null })
    res.json({ message: req.body.hidden ? 'Reporte ocultado' : 'Reporte visible de nuevo' })
  }

  /** Borrado lógico: desaparece de la app pero el admin lo conserva para estadísticas y PDF */
  static async deleteReport(req: Request, res: Response) {
    const report = await Report.findByPk(req.params.reportId)
    if (!report) {
      res.status(404).json({ error: 'Reporte no encontrado' })
      return
    }
    await report.update({ deletedById: req.user!.id })
    await report.destroy()
    res.json({ message: 'Reporte eliminado (el administrador puede restaurarlo)' })
  }

  // ---------- Usuarios / baneos ----------
  static async getUsers(req: Request, res: Response) {
    const where: any = {}
    if (req.query.q) {
      const q = `%${req.query.q}%`
      where[Op.or] = [{ name: { [Op.iLike]: q } }, { email: { [Op.iLike]: q } }]
    }
    if (req.query.role) where.role = req.query.role
    if (req.query.banned) where.banned = req.query.banned === 'true'
    const users = await User.findAll({ where, order: [['createdAt', 'DESC']], limit: 100 })
    const counts = await Report.count({ where: { userId: users.map((u) => u.id) }, group: ['userId'] })
    const byUser = Object.fromEntries((counts as any[]).map((c) => [c.userId, Number(c.count)]))
    res.json(users.map((u) => ({ ...u.toJSON(), reportsCount: byUser[u.id] ?? 0 })))
  }

  static async banUser(req: Request, res: Response) {
    const target = await User.findByPk(req.params.userId)
    if (!target) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }
    if (!canSanction(req.user!, target)) {
      res.status(403).json({ error: 'No puedes banear a este usuario' })
      return
    }
    const reason = req.body.reason as string
    await db.transaction(async (t) => {
      await target.update({ banned: true, bannedReason: reason, bannedAt: new Date() }, { transaction: t })
      await Blacklist.upsert({ email: target.email, reason, createdById: req.user!.id }, { transaction: t })
      if (req.body.hideReports !== false) {
        await Report.update(
          { hidden: true, hiddenReason: `Usuario baneado: ${reason}` },
          { where: { userId: target.id }, transaction: t },
        )
      }
    })
    res.json({ message: `${target.name} fue baneado y su correo agregado a la lista negra` })
  }

  static async unbanUser(req: Request, res: Response) {
    const target = await User.findByPk(req.params.userId)
    if (!target) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }
    if (!canSanction(req.user!, target)) {
      res.status(403).json({ error: 'No puedes modificar a este usuario' })
      return
    }
    await db.transaction(async (t) => {
      await target.update({ banned: false, bannedReason: null, bannedAt: null }, { transaction: t })
      await Blacklist.destroy({ where: { email: target.email }, transaction: t })
      await Report.update(
        { hidden: false, hiddenReason: null },
        { where: { userId: target.id, hiddenReason: { [Op.like]: 'Usuario baneado:%' } }, transaction: t },
      )
    })
    res.json({ message: `${target.name} fue desbaneado` })
  }

  // ---------- Lista negra ----------
  static async getBlacklist(_req: Request, res: Response) {
    const list = await Blacklist.findAll({
      include: [{ model: User, attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    })
    res.json(list)
  }

  /** Vetar un correo aunque todavía no tenga cuenta */
  static async addToBlacklist(req: Request, res: Response) {
    const email = String(req.body.email).toLowerCase()
    const target = await User.findOne({ where: { email } })
    if (target && !canSanction(req.user!, target)) {
      res.status(403).json({ error: 'No puedes vetar a este usuario' })
      return
    }
    if (await Blacklist.findOne({ where: { email } })) {
      res.status(409).json({ error: 'Ese correo ya está en la lista negra' })
      return
    }
    await db.transaction(async (t) => {
      await Blacklist.create({ email, reason: req.body.reason, createdById: req.user!.id }, { transaction: t })
      if (target) await target.update({ banned: true, bannedReason: req.body.reason, bannedAt: new Date() }, { transaction: t })
    })
    res.status(201).json({ message: 'Correo agregado a la lista negra' })
  }

  static async removeFromBlacklist(req: Request, res: Response) {
    const entry = await Blacklist.findByPk(req.params.id)
    if (!entry) {
      res.status(404).json({ error: 'Registro no encontrado' })
      return
    }
    const target = await User.findOne({ where: { email: entry.email } })
    if (target && !canSanction(req.user!, target)) {
      res.status(403).json({ error: 'No puedes modificar a este usuario' })
      return
    }
    await db.transaction(async (t) => {
      await entry.destroy({ transaction: t })
      if (target) await target.update({ banned: false, bannedReason: null, bannedAt: null }, { transaction: t })
    })
    res.json({ message: 'Correo eliminado de la lista negra' })
  }
}
