import { fn, col } from 'sequelize'
import { ReportVote } from '../models/ReportVote'
import type { VoteValue } from '../models/constants'
import type { User } from '../models/User'

export type VoteSummary = { solucionado: number; sin_solucion: number; mine: VoteValue | null }

/** Conteo de votos para muchos reportes en 2 consultas (sin N+1) */
export async function getVoteSummaries(reportIds: number[], viewer?: User | null) {
  const map = new Map<number, VoteSummary>()
  reportIds.forEach((id) => map.set(id, { solucionado: 0, sin_solucion: 0, mine: null }))
  if (reportIds.length === 0) return map

  const rows = (await ReportVote.findAll({
    attributes: ['reportId', 'value', [fn('COUNT', col('id')), 'count']],
    where: { reportId: reportIds },
    group: ['reportId', 'value'],
    raw: true,
  })) as unknown as { reportId: number; value: VoteValue; count: string }[]
  rows.forEach((r) => {
    const s = map.get(r.reportId)
    if (s) s[r.value] = Number(r.count)
  })

  if (viewer) {
    const mine = await ReportVote.findAll({ where: { reportId: reportIds, userId: viewer.id }, attributes: ['reportId', 'value'] })
    mine.forEach((v) => {
      const s = map.get(v.reportId)
      if (s) s.mine = v.value
    })
  }
  return map
}
