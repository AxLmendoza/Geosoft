import api from '@/lib/axios'
import { rethrow } from '@/lib/errors'
import type { InvitationResult, StaffActivity, StaffDetail, StaffMember, StaffMeta } from '@/types'

/** Gestión de responsables (solo administración; el backend valida cada regla) */

export type StaffStatusFilter = '' | 'activo' | 'pendiente' | 'desactivado' | 'suspendido'
export type StaffFilters = { q?: string; areaId?: number; role?: 'operativo' | 'moderador' | 'admin'; status?: StaffStatusFilter }

export type StaffInput = { name: string; email: string; role: 'operativo' | 'moderador'; areaId?: number | null }

type Msg = { message: string }

export async function getStaffMeta() {
  return (await api.get<StaffMeta>('/admin/staff/meta')).data
}

export async function getStaff(filters: StaffFilters = {}) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '' && v !== 0))
  return (await api.get<StaffMember[]>('/admin/staff', { params })).data
}

export async function getStaffMember(id: number) {
  return (await api.get<StaffDetail>(`/admin/staff/${id}`)).data
}

export async function getStaffActivity(id: number) {
  return (await api.get<StaffActivity>(`/admin/staff/${id}/activity`)).data
}

export async function createStaff(input: StaffInput) {
  try {
    return (await api.post<{ member: StaffMember; invitation: InvitationResult }>('/admin/staff', input)).data
  } catch (e) { rethrow(e) }
}

/** Solo se envían los campos que cambiaron */
export async function updateStaff({ id, ...changes }: Partial<StaffInput> & { id: number }) {
  try {
    return (await api.patch<{ member: StaffMember; releasedReports: number; invitation: InvitationResult | null }>(`/admin/staff/${id}`, changes)).data
  } catch (e) { rethrow(e) }
}

export async function setStaffActive({ id, active }: { id: number; active: boolean }) {
  try {
    return (await api.patch<{ member: StaffMember; releasedReports: number; message: string }>(`/admin/staff/${id}/status`, { active })).data
  } catch (e) { rethrow(e) }
}

export async function resendInvitation(id: number) {
  try {
    return (await api.post<{ member: StaffMember; invitation: InvitationResult }>(`/admin/staff/${id}/invitation`)).data
  } catch (e) { rethrow(e) }
}

export async function reassignStaffReports({ id, toUserId }: { id: number; toUserId: number | null }) {
  try {
    return (await api.post<Msg>(`/admin/staff/${id}/reassign`, { toUserId })).data.message
  } catch (e) { rethrow(e) }
}
