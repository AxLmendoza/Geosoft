import { Sequelize } from 'sequelize-typescript'
import dotenv from 'dotenv'
import { User } from '../models/User'
import { Category } from '../models/Category'
import { Report } from '../models/Report'
import { ReportFlag } from '../models/ReportFlag'
import { ReportHistory } from '../models/ReportHistory'
import { Blacklist } from '../models/Blacklist'
import { ReportVote } from '../models/ReportVote'
import { Area } from '../models/Area'
import { AuditLog } from '../models/AuditLog'
import { migrateColumns, migrateEnums } from './migrations'

dotenv.config()

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL en el archivo .env')
}

const useSSL = process.env.DATABASE_SSL !== 'false'

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal']

/**
 * `sync({ alter: true })` puede reescribir columnas y restricciones. Antes se activaba con
 * cualquier NODE_ENV distinto de production, así que `npm run dev` con DATABASE_URL de Render
 * alteraba la base de datos real. Ahora solo se usa contra una BD local o si se pide
 * explícitamente con DB_SYNC_ALTER=true. Las columnas nuevas las agrega migrateColumns().
 */
export function shouldAlterSchema(url = process.env.DATABASE_URL ?? '') {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.DB_SYNC_ALTER) return process.env.DB_SYNC_ALTER === 'true'
  try {
    return LOCAL_HOSTS.includes(new URL(url).hostname.toLowerCase())
  } catch {
    return false
  }
}

export const db = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  models: [Area, User, Category, Report, ReportFlag, ReportHistory, Blacklist, ReportVote, AuditLog],
  dialectOptions: useSSL
    ? { ssl: { require: true, rejectUnauthorized: false } } // Render usa SSL
    : {},
})

export async function connectDB() {
  await db.authenticate()
  // Valores nuevos de ENUM (estados / rol operativo) antes de sincronizar
  await migrateEnums(db)
  // alter solo en BD local (ver shouldAlterSchema). En cualquier otro caso solo crea tablas nuevas
  await db.sync({ alter: shouldAlterSchema() })
  // Columnas e índices nuevos (idempotente, no destructivo) para producción
  await migrateColumns(db)
  console.log('✔ Base de datos conectada')
}
