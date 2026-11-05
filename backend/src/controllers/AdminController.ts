import type { Request, Response } from 'express'
import { User } from '../models/User'
import { Report } from '../models/Report'
import { Area } from '../models/Area'
import type { Role } from '../models/constants'
import { computeStats } from '../utils/stats'
import { buildStatsPdf } from '../utils/pdfReport'

const range = (req: Request) => ({ from: req.query.from as string | undefined, to: req.query.to as string | undefined })

export class AdminController {
  /**
   * Cambia el rol de un usuario: ciudadano, moderador u operativo (este último requiere un área).
   * El rol de administrador no se asigna desde aquí.
   */
  static async setRole(req: Request, res: Response) {
    const target = await User.findByPk(req.params.userId)
    if (!target) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }
    if (target.id === req.user!.id || target.role === 'admin') {
      res.status(403).json({ error: 'No puedes cambiar el rol de un administrador' })
      return
    }
    if (target.banned || !target.confirmed) {
      res.status(400).json({ error: 'El usuario debe estar confirmado y no baneado' })
      return
    }
    const role = req.body.role as Role
    let areaId: number | null = null
    if (role === 'operativo') {
      const area = await Area.findByPk(req.body.areaId)
      if (!area || !area.active) {
        res.status(400).json({ error: 'Selecciona un área activa para el personal operativo' })
        return
      }
      areaId = area.id
    }
    await target.update({ role, areaId })
    const msg: Record<string, string> = {
      ciudadano: `${target.name} ahora es ciudadano`,
      moderador: `${target.name} ahora es moderador`,
      operativo: `${target.name} ahora es personal operativo`,
    }
    res.json({ message: msg[role] })
  }

  /** Datos del dashboard (?from=YYYY-MM-DD&to=YYYY-MM-DD, por defecto últimos 12 meses) */
  static async stats(req: Request, res: Response) {
    // El detalle completo solo se usa en el PDF: no se manda al dashboard
    const { reports: _detail, ...stats } = await computeStats(range(req))
    res.json(stats)
  }

  /** Descarga el informe en PDF con gráficas y el detalle de reportes */
  static async statsPdf(req: Request, res: Response) {
    const stats = await computeStats(range(req))
    const pdf = await buildStatsPdf(stats, req.user!.name)
    const stamp = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="geoscript-informe-${stamp}.pdf"`)
    res.send(pdf)
  }

  /** Restaura un reporte con borrado lógico */
  static async restoreReport(req: Request, res: Response) {
    const report = await Report.findByPk(req.params.reportId, { paranoid: false })
    if (!report || !report.deletedAt) {
      res.status(404).json({ error: 'No hay un reporte eliminado con ese ID' })
      return
    }
    await report.restore()
    await report.update({ deletedById: null })
    res.json({ message: 'Reporte restaurado' })
  }
}
