import api from '@/lib/axios'
import { rethrow } from '@/lib/errors'
import type { Area, AreaRef, AreaType, AttentionSummary, Category, Paginated, Report, ReportStatus, Severity } from '@/types'

type Msg = { message: string }

/* ---------------- Bandeja de atención (admin, moderación, operativo) ---------------- */

export type AttentionFilters = {
  status?: ReportStatus
  area?: number | 'none'
  category?: number
  severity?: Severity
  q?: string
  open?: 'true'
  page?: number
  limit?: number
}

export async function getAttentionReports(params: AttentionFilters) {
  return (await api.get<Paginated<Report>>('/attention/reports', { params })).data
}

export async function getAttentionSummary() {
  return (await api.get<AttentionSummary>('/attention/summary')).data
}

export type StaleReport = Pick<Report, 'id' | 'title' | 'status' | 'severity' | 'colonia' | 'createdAt'> & {
  area: AreaRef | null
  lastMovementAt: string | null
  daysWithoutMovement: number
}

/** Reportes abiertos sin movimiento en N días (por defecto STALE_REPORT_DAYS del servidor) */
export async function getStaleReports(days?: number) {
  return (await api.get<{ days: number; total: number; reports: StaleReport[] }>('/attention/stale', { params: { days } })).data
}

/** Con evidencia opcional: se manda como multipart */
const toForm = (fields: Record<string, string | boolean | undefined>, image?: File | null) => {
  const data = new FormData()
  Object.entries(fields).forEach(([k, v]) => v !== undefined && v !== '' && data.append(k, String(v)))
  if (image) data.append('image', image)
  return data
}

export async function updateAttentionStatus(input: { id: number; status: ReportStatus; note?: string; internal?: boolean; image?: File | null }) {
  try {
    const { id, image, ...fields } = input
    return (await api.patch<Msg>(`/attention/reports/${id}/status`, toForm(fields, image))).data.message
  } catch (e) { rethrow(e) }
}

export async function addAttentionUpdate(input: { id: number; note?: string; internal?: boolean; image?: File | null }) {
  try {
    const { id, image, ...fields } = input
    return (await api.post<Msg>(`/attention/reports/${id}/updates`, toForm(fields, image))).data.message
  } catch (e) { rethrow(e) }
}

export async function assignReport(input: { id: number; areaId: number | null; note?: string }) {
  try {
    return (await api.patch<Msg>(`/attention/reports/${input.id}/assign`, { areaId: input.areaId, note: input.note })).data.message
  } catch (e) { rethrow(e) }
}

/* ---------------- Áreas ---------------- */

export async function getPublicAreas() {
  return (await api.get<AreaRef[]>('/areas')).data
}

export async function getAdminAreas() {
  return (await api.get<Area[]>('/admin/areas')).data
}

export type AreaInput = { name: string; type: AreaType; description?: string; contactEmail?: string; active?: boolean }

export async function saveArea({ id, ...input }: AreaInput & { id?: number }) {
  try {
    return id ? (await api.put<Area>(`/admin/areas/${id}`, input)).data : (await api.post<Area>('/admin/areas', input)).data
  } catch (e) { rethrow(e) }
}

/* ---------------- Categorías (configuración) ---------------- */

export async function getAdminCategories() {
  return (await api.get<Category[]>('/admin/categories')).data
}

export type CategoryInput = { name?: string; color?: string; description?: string; areaId?: number | null }

export async function saveCategory({ id, ...input }: CategoryInput & { id?: number }) {
  try {
    return id ? (await api.put<Category>(`/admin/categories/${id}`, input)).data : (await api.post<Category>('/admin/categories', input)).data
  } catch (e) { rethrow(e) }
}
