import { Op } from 'sequelize'
import { Report } from '../models/Report'
import { Category } from '../models/Category'
import { User } from '../models/User'
import { Area } from '../models/Area'
import { ReportFlag } from '../models/ReportFlag'
import { ReportVote } from '../models/ReportVote'
import { OPEN_STATUSES, REPORT_STATUS, SEVERITY, SEVERITY_WEIGHT, type ReportStatus, type Severity } from '../models/constants'

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

/** Solo las columnas que usan el tablero y el PDF (sin la descripción, que es TEXT) */
type Row = {
  id: number
  title: string
  createdAt: Date
  resolvedAt: Date | null
  deletedAt: Date | null
  categoryId: number
  areaId: number | null
  colonia: string | null
  status: ReportStatus
  severity: Severity
  hidden: boolean
}

const isOpen = (s: ReportStatus) => OPEN_STATUSES.includes(s)

/**
 * Estadísticas para el dashboard y el PDF del admin.
 * Incluye reportes con borrado lógico (paranoid: false).
 * Rendimiento: una consulta con columnas mínimas (raw) y agregación en una sola pasada.
 */
export async function computeStats(range: StatsRange) {
  const { start, end } = resolveRange(range)
  const inRange = { createdAt: { [Op.between]: [start, end] } }

  const [reports, categories, areas] = await Promise.all([
    Report.findAll({
      paranoid: false,
      where: inRange,
      attributes: ['id', 'title', 'createdAt', 'resolvedAt', 'deletedAt', 'categoryId', 'areaId', 'colonia', 'status', 'severity', 'hidden'],
      order: [['createdAt', 'DESC']],
      raw: true,
    }) as unknown as Promise<Row[]>,
    Category.findAll({ attributes: ['id', 'name', 'color'], order: [['id', 'ASC']], raw: true }),
    Area.findAll({ attributes: ['id', 'name', 'type'], order: [['name', 'ASC']], raw: true }),
  ])

  const months = monthsBetween(start, end)
  const monthly = new Map(months.map((m) => [m, { month: m, reportados: 0, resueltos: 0 }]))
  const byCat = new Map<number, { total: number; resueltos: number; abiertos: number }>()
  const byArea = new Map<number | null, { total: number; abiertos: number; resueltos: number; horas: number[] }>()
  const byStatus = new Map<ReportStatus, number>(REPORT_STATUS.map((s) => [s, 0]))
  const bySeverity = new Map<Severity, number>(SEVERITY.map((s) => [s, 0]))
  const zones = new Map<string, { colonia: string; abiertos: number; criticos: number; indice: number }>()
  const resolutionHours: number[] = []
  let total = 0
  let resueltos = 0
  let abiertos = 0
  let rechazados = 0
  let ocultos = 0

  for (const r of reports) {
    if (r.deletedAt) continue
    total++
    const open = isOpen(r.status)
    const resolved = r.status === 'resuelto' || r.status === 'cerrado'
    if (open) abiertos++
    if (resolved) resueltos++
    if (r.status === 'rechazado') rechazados++
    if (r.hidden) ocultos++
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1)
    bySeverity.set(r.severity, (bySeverity.get(r.severity) ?? 0) + 1)

    const m = monthly.get(monthKey(new Date(r.createdAt)))
    if (m) m.reportados++
    let hours: number | null = null
    if (resolved && r.resolvedAt) {
      hours = (new Date(r.resolvedAt).getTime() - new Date(r.createdAt).getTime()) / 36e5
      resolutionHours.push(hours)
      const rm = monthly.get(monthKey(new Date(r.resolvedAt)))
      if (rm) rm.resueltos++
    }

    const c = byCat.get(r.categoryId) ?? { total: 0, resueltos: 0, abiertos: 0 }
    c.total++
    if (resolved) c.resueltos++
    if (open) c.abiertos++
    byCat.set(r.categoryId, c)

    const a = byArea.get(r.areaId) ?? { total: 0, abiertos: 0, resueltos: 0, horas: [] }
    a.total++
    if (open) a.abiertos++
    if (resolved) a.resueltos++
    if (hours !== null) a.horas.push(hours)
    byArea.set(r.areaId, a)

    // Índice de priorización por zona: suma del peso de gravedad de los reportes abiertos
    if (open) {
      const key = (r.colonia || 'Sin colonia').trim()
      const z = zones.get(key) ?? { colonia: key, abiertos: 0, criticos: 0, indice: 0 }
      z.abiertos++
      if (r.severity === 'critica') z.criticos++
      z.indice += SEVERITY_WEIGHT[r.severity]
      zones.set(key, z)
    }
  }

  const avg = (list: number[]) => (list.length ? list.reduce((x, y) => x + y, 0) / list.length : null)
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  const [users, moderators, operativos, banned, pendingFlags, votes] = await Promise.all([
    User.count(),
    User.count({ where: { role: 'moderador' } }),
    User.count({ where: { role: 'operativo' } }),
    User.count({ where: { banned: true } }),
    ReportFlag.count({ where: { status: 'pendiente' } }),
    // JOIN en lugar de un IN (...) con miles de IDs
    ReportVote.count({ include: [{ model: Report, attributes: [], where: inRange, required: true }] }),
  ])

  return {
    range: { from: start.toISOString(), to: end.toISOString() },
    totals: {
      total,
      resueltos,
      abiertos,
      rechazados,
      ocultos,
      eliminados: reports.length - total,
      tasaResolucion: total ? resueltos / total : 0,
      promedioHorasSolucion: avg(resolutionHours),
      votos: votes,
      usuarios: users,
      moderadores: moderators,
      operativos,
      baneados: banned,
      denunciasPendientes: pendingFlags,
    },
    monthly: [...monthly.values()],
    byCategory: [...byCat.entries()]
      .map(([id, c]) => ({ id, name: categoryById.get(id)?.name ?? '—', color: categoryById.get(id)?.color ?? '#64748b', ...c }))
      .sort((a, b) => b.total - a.total),
    byArea: [...byArea.entries()]
      .map(([id, a]) => {
        const area = areas.find((x) => x.id === id)
        return {
          id,
          name: area?.name ?? 'Sin área asignada',
          type: area?.type ?? null,
          total: a.total,
          abiertos: a.abiertos,
          resueltos: a.resueltos,
          promedioHorasSolucion: avg(a.horas),
        }
      })
      .sort((a, b) => b.abiertos - a.abiertos || b.total - a.total),
    byStatus: REPORT_STATUS.map((status) => ({ status, total: byStatus.get(status) ?? 0 })),
    bySeverity: SEVERITY.map((severity) => ({ severity, total: bySeverity.get(severity) ?? 0 })),
    priorityZones: [...zones.values()].sort((a, b) => b.indice - a.indice).slice(0, 10),
    // Detalle para la tabla del PDF
    reports: reports.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      deletedAt: r.deletedAt,
      category: categoryById.get(r.categoryId)?.name ?? '',
      colonia: r.colonia,
      status: r.status,
      severity: r.severity,
      hidden: r.hidden,
    })),
  }
}

export type Stats = Awaited<ReturnType<typeof computeStats>>
