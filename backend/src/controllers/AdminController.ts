import type { Request, Response } from 'express'
import { User } from '../models/User'
import { Report } from '../models/Report'
import { computeStats } from '../utils/stats'
import { buildStatsPdf } from '../utils/pdfReport'

const range = (req: Request) => ({ from: req.query.from as string | undefined, to: req.query.to as string | undefined })

export class AdminController {
  /** Asigna o quita el rol de moderador */
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
    await target.update({ role: req.body.role })
    res.json({ message: req.body.role === 'moderador' ? `${target.name} ahora es moderador` : `${target.name} ya no es moderador` })
  }

  /** Datos del dashboard (?from=YYYY-MM-DD&to=YYYY-MM-DD, por defecto últimos 12 meses) */
  static async stats(req: Request, res: Response) {
    const { reports, ...stats } = await computeStats(range(req))
    res.json({ ...stats, recent: reports.slice(0, 20) })
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
