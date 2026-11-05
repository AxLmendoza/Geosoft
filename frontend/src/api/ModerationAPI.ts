import api from '@/lib/axios'
import { rethrow } from '@/lib/errors'
import type { AdminStats, BlacklistEntry, Flag, FlagStatus, Report, ReportStatus, Role, Severity, User } from '@/types'

type Msg = { message: string }

export async function getFlags(status: FlagStatus = 'pendiente') {
  return (await api.get<Flag[]>('/moderation/flags', { params: { status } })).data
}

export async function reviewFlag({ id, status, hideReport }: { id: number; status: 'procedente' | 'descartada'; hideReport?: boolean }) {
  try {
    return (await api.patch<Msg>(`/moderation/flags/${id}`, { status, hideReport })).data.message
  } catch (e) { rethrow(e) }
}

export async function getModerationReports(params: {
  status?: ReportStatus
  hidden?: 'true' | 'false'
  deleted?: 'true'
  community?: 'solucionado'
}) {
  return (await api.get<Report[]>('/moderation/reports', { params })).data
}

export async function updateReportStatus({ id, status, note }: { id: number; status: ReportStatus; note?: string }) {
  try {
    return (await api.patch<Msg>(`/moderation/reports/${id}/status`, { status, note })).data.message
  } catch (e) { rethrow(e) }
}

export async function setReportVisibility({ id, hidden, reason }: { id: number; hidden: boolean; reason?: string }) {
  try {
    return (await api.patch<Msg>(`/moderation/reports/${id}/visibility`, { hidden, reason })).data.message
  } catch (e) { rethrow(e) }
}

export async function deleteReportAsModerator(id: number) {
  try {
    return (await api.delete<Msg>(`/moderation/reports/${id}`)).data.message
  } catch (e) { rethrow(e) }
}

export async function getUsers(params: { q?: string; role?: Role | ''; banned?: 'true' | 'false' | '' }) {
  return (await api.get<User[]>('/moderation/users', { params })).data
}

export async function banUser({ id, reason, hideReports }: { id: number; reason: string; hideReports: boolean }) {
  try {
    return (await api.post<Msg>(`/moderation/users/${id}/ban`, { reason, hideReports })).data.message
  } catch (e) { rethrow(e) }
}

export async function unbanUser(id: number) {
  try {
    return (await api.delete<Msg>(`/moderation/users/${id}/ban`)).data.message
  } catch (e) { rethrow(e) }
}

export async function getBlacklist() {
  return (await api.get<BlacklistEntry[]>('/moderation/blacklist')).data
}

export async function addToBlacklist(data: { email: string; reason: string }) {
  try {
    return (await api.post<Msg>('/moderation/blacklist', data)).data.message
  } catch (e) { rethrow(e) }
}

export async function removeFromBlacklist(id: number) {
  try {
    return (await api.delete<Msg>(`/moderation/blacklist/${id}`)).data.message
  } catch (e) { rethrow(e) }
}

/** Solo admin */
export async function setUserRole({ id, role, areaId }: { id: number; role: 'ciudadano' | 'moderador' | 'operativo'; areaId?: number }) {
  try {
    return (await api.patch<Msg>(`/admin/users/${id}/role`, { role, areaId })).data.message
  } catch (e) { rethrow(e) }
}

/** Solo admin: restaurar un reporte con borrado lógico */
export async function restoreReport(id: number) {
  try {
    return (await api.patch<Msg>(`/admin/reports/${id}/restore`)).data.message
  } catch (e) { rethrow(e) }
}

export type AdminReportFilters = {
  q?: string
  status?: ReportStatus
  category?: number
  deleted?: 'true' | 'all'
  page?: number
  limit?: number
}

/** Solo admin: CRUD de reportes (paginado; el total viene en la cabecera X-Total-Count) */
export async function getAdminReports(params: AdminReportFilters) {
  const res = await api.get<Report[]>('/admin/reports', { params })
  return { data: res.data, total: Number(res.headers['x-total-count'] ?? res.data.length) }
}

export type AdminReportInput = {
  title: string
  description: string
  categoryId: number
  severity: Severity
  status: ReportStatus
  colonia: string
  calle: string
  anonymous: boolean
  hidden: boolean
  hiddenReason: string
  note?: string
  lat: number
  lng: number
  image?: File | null
}

const toFormData = (input: AdminReportInput) => {
  const data = new FormData()
  Object.entries(input).forEach(([key, value]) => {
    if (value instanceof File) data.append(key, value)
    else if (value !== undefined && value !== null) data.append(key, String(value))
  })
  return data
}

export async function createAdminReport(input: AdminReportInput) {
  try {
    return (await api.post<Report>('/admin/reports', toFormData(input))).data
  } catch (e) { rethrow(e) }
}

export async function updateAdminReport({ id, ...input }: AdminReportInput & { id: number }) {
  try {
    return (await api.put<Report>(`/admin/reports/${id}`, toFormData(input))).data
  } catch (e) { rethrow(e) }
}

/** Borrado definitivo (no se puede restaurar) */
export async function destroyAdminReport(id: number) {
  try {
    return (await api.delete<Msg>(`/admin/reports/${id}`)).data.message
  } catch (e) { rethrow(e) }
}

export type StatsRange = { from?: string; to?: string }

export async function getStats(range: StatsRange) {
  return (await api.get<AdminStats>('/admin/stats', { params: range })).data
}

/** Descarga el PDF (va con el token, por eso no es un <a href>) */
export async function downloadStatsPdf(range: StatsRange) {
  try {
    const { data, headers } = await api.get<Blob>('/admin/stats/pdf', { params: range, responseType: 'blob' })
    const name = /filename="(.+)"/.exec(headers['content-disposition'] ?? '')?.[1] ?? 'geoscript-informe.pdf'
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) { rethrow(e) }
}
