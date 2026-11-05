import api from '@/lib/axios'
import { rethrow } from '@/lib/errors'
import type { Category, FlagReason, NewReportForm, Report, ReportFilters, VoteSummary, VoteValue } from '@/types'

export async function getCategories() {
  return (await api.get<Category[]>('/categories')).data
}

export async function getReports(filters: ReportFilters = {}) {
  return (await api.get<Report[]>('/reports', { params: filters })).data
}

export async function getMyReports() {
  return (await api.get<Report[]>('/reports/mine')).data
}

export async function getReport(id: number) {
  return (await api.get<Report>(`/reports/${id}`)).data
}

export type CreateReportInput = NewReportForm & { image: File; lat: number; lng: number }

export async function createReport(input: CreateReportInput) {
  const data = new FormData()
  Object.entries(input).forEach(([key, value]) => {
    if (value instanceof File) data.append(key, value)
    else if (value !== undefined && value !== null && value !== '') data.append(key, String(value))
  })
  try {
    return (await api.post<Report>('/reports', data)).data
  } catch (e) { rethrow(e) }
}

export async function deleteReport(id: number) {
  try {
    return (await api.delete<{ message: string }>(`/reports/${id}`)).data.message
  } catch (e) { rethrow(e) }
}

export async function flagReport({ id, reason, comment }: { id: number; reason: FlagReason; comment?: string }) {
  try {
    return (await api.post<{ message: string }>(`/reports/${id}/flags`, { reason, comment })).data.message
  } catch (e) { rethrow(e) }
}

/** El autor agrega información adicional (texto y/o foto) a su reporte */
export async function addReportInfo({ id, note, image }: { id: number; note?: string; image?: File | null }) {
  const data = new FormData()
  if (note) data.append('note', note)
  if (image) data.append('image', image)
  try {
    return (await api.post<{ message: string }>(`/reports/${id}/updates`, data)).data.message
  } catch (e) { rethrow(e) }
}

/** Ya quedó / Sigue igual. Votar lo mismo otra vez quita el voto */
export async function voteReport({ id, value }: { id: number; value: VoteValue }) {
  try {
    return (await api.post<VoteSummary>(`/reports/${id}/vote`, { value })).data
  } catch (e) { rethrow(e) }
}

/** El autor: "me dieron seguimiento" (en_proceso) o "ya quedó" (resuelto) */
export async function updateOwnerStatus({ id, status, note }: { id: number; status: 'en_proceso' | 'resuelto'; note?: string }) {
  try {
    return (await api.patch<{ message: string }>(`/reports/${id}/status`, { status, note })).data.message
  } catch (e) { rethrow(e) }
}
