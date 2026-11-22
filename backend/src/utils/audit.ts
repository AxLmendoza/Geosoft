import type { Request } from 'express'
import type { Transaction } from 'sequelize'
import { AuditLog } from '../models/AuditLog'

/** Claves que nunca se guardan en la auditoría aunque lleguen por error en `details` */
const SECRET_KEYS = /pass|token|secret|code|hash/i

function sanitize(details?: Record<string, unknown> | null) {
  if (!details) return null
  return Object.fromEntries(Object.entries(details).filter(([k, v]) => v !== undefined && !SECRET_KEYS.test(k)))
}

export type AuditEntry = {
  action: string
  targetType: 'user' | 'report' | 'area' | 'category' | 'blacklist'
  targetId?: number | null
  details?: Record<string, unknown> | null
}

/**
 * Registra una acción administrativa. Dentro de una transacción se guarda con ella
 * (si la acción se revierte, el registro también). Fuera de transacción nunca hace
 * fallar la petición: si no se puede guardar, solo se avisa en consola.
 */
export async function audit(req: Pick<Request, 'user' | 'ip'> | null, entry: AuditEntry, transaction?: Transaction) {
  const row = {
    actorId: req?.user?.id ?? null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    details: sanitize(entry.details),
    ip: req?.ip?.slice(0, 45) ?? null,
  }
  if (transaction) {
    await AuditLog.create(row, { transaction })
    return
  }
  try {
    await AuditLog.create(row)
  } catch (error) {
    console.error(`✖ No se pudo registrar la auditoría (${entry.action}):`, (error as Error).message)
  }
}
