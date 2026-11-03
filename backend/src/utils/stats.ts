import { Op } from 'sequelize'
import { Report } from '../models/Report'
import { Category } from '../models/Category'
import { User } from '../models/User'
import { ReportFlag } from '../models/ReportFlag'
import { ReportVote } from '../models/ReportVote'
import { OPEN_STATUSES, REPORT_STATUS, SEVERITY, SEVERITY_WEIGHT } from '../models/constants'

export type StatsRange = { from?: string; to?: string }

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** Lista de meses (YYYY-MM) entre dos fechas, máximo 24 */
function monthsBetween(from: Date, to: Date) {
  const out: string[] = []
  const cur = new Date(from.getFullYear(), from.getMonth(), 1)
  while (cur <= to && out.length < 24) {
    out.push(monthKey(cur))
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}

/** Rango por defecto: últimos 12 meses */
export function resolveRange({ from, to }: StatsRange) {
  const end = to ? new Date(`${to}T23:59:59`) : new Date()
  const start = from ? new Date(`${from}T00:00:00`) : new Date(end.getFullYear(), end.getMonth() - 11, 1)
  return { start, end }
}

/**
 * Estadísticas para el dashboard y el PDF del admin.
 * Incluye reportes con borrado lógico (paranoid: false).
 */
export async function computeStats(range: StatsRange) {
  const { start, end } = resolveRange(range)

  const reports = await Report.findAll({
    paranoid: false,
    where: { createdAt: { [Op.between]: [start, end] } },
    include: [{ model: Category, attributes: ['id', 'name', 'color', 'slug'] }],
    order: [['createdAt', 'DESC']],
  })
  const categories = await Category.findAll({ order: [['id', 'ASC']] })

  const alive = reports.filter((r) => !r.deletedAt)
  const resolved = alive.filter((r) => r.status === 'resuelto')
  const open = alive.filter((r) => OPEN_STATUSES.includes(r.status))

  const resolutionHours = resolved
    .filter((r) => r.resolvedAt)
    .map((r) => (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt).getTime()) / 36e5)
  const avgResolutionHours = resolutionHours.length
    ? resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length
    : null

  // Por mes: creados vs resueltos
  const months = monthsBetween(start, end)
  const monthly = months.map((month) => ({
    month,
    reportados: alive.filter((r) => monthKey(new Date(r.createdAt)) === month).length,
    resueltos: resolved.filter((r) => r.resolvedAt && monthKey(new Date(r.resolvedAt)) === month).length,
  }))

  const byCategory = categories
    .map((c) => {
      const list = alive.filter((r) => r.categoryId === c.id)
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        total: list.length,
        resueltos: list.filter((r) => r.status === 'resuelto').length,
        abiertos: list.filter((r) => OPEN_STATUSES.includes(r.status)).length,
      }
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)

  const byStatus = REPORT_STATUS.map((status) => ({ status, total: alive.filter((r) => r.status === status).length }))
  const bySeverity = SEVERITY.map((severity) => ({ severity, total: alive.filter((r) => r.severity === severity).length }))

  // Índice de priorización por zona: suma del peso de gravedad de los reportes abiertos
  const zones = new Map<string, { colonia: string; abiertos: number; criticos: number; indice: number }>()
  open.forEach((r) => {
    const key = (r.colonia || 'Sin colonia').trim()
    const z = zones.get(key) ?? { colonia: key, abiertos: 0, criticos: 0, indice: 0 }
    z.abiertos++
    if (r.severity === 'critica') z.criticos++
    z.indice += SEVERITY_WEIGHT[r.severity]
    zones.set(key, z)
  })
  const priorityZones = [...zones.values()].sort((a, b) => b.indice - a.indice).slice(0, 10)

  const [users, moderators, banned, pendingFlags, votes] = await Promise.all([
    User.count(),
    User.count({ where: { role: 'moderador' } }),
    User.count({ where: { banned: true } }),
    ReportFlag.count({ where: { status: 'pendiente' } }),
    ReportVote.count({ where: { reportId: alive.map((r) => r.id) } }),
  ])

  return {
    range: { from: start.toISOString(), to: end.toISOString() },
    totals: {
      total: alive.length,
      resueltos: resolved.length,
      abiertos: open.length,
      rechazados: alive.filter((r) => r.status === 'rechazado').length,
      ocultos: alive.filter((r) => r.hidden).length,
      eliminados: reports.length - alive.length,
      tasaResolucion: alive.length ? resolved.length / alive.length : 0,
      promedioHorasSolucion: avgResolutionHours,
      votos: votes,
      usuarios: users,
      moderadores: moderators,
      baneados: banned,
      denunciasPendientes: pendingFlags,
    },
    monthly,
    byCategory,
    byStatus,
    bySeverity,
    priorityZones,
    // Detalle para la tabla del PDF
    reports: reports.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt as Date,
      resolvedAt: r.resolvedAt,
      deletedAt: r.deletedAt,
      category: r.category?.name ?? '',
      colonia: r.colonia,
      status: r.status,
      severity: r.severity,
      hidden: r.hidden,
    })),
  }
}

export type Stats = Awaited<ReturnType<typeof computeStats>>
