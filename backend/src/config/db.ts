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
import { migrateColumns, migrateEnums } from './migrations'

dotenv.config()

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL en el archivo .env')
}

const useSSL = process.env.DATABASE_SSL !== 'false'

export const db = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  models: [Area, User, Category, Report, ReportFlag, ReportHistory, Blacklist, ReportVote],
  dialectOptions: useSSL
    ? { ssl: { require: true, rejectUnauthorized: false } } // Render usa SSL
    : {},
})

export async function connectDB() {
  await db.authenticate()
  // Valores nuevos de ENUM (estados / rol operativo) antes de sincronizar
  await migrateEnums(db)
  // alter: true ajusta tablas en desarrollo. En producción solo crea tablas nuevas
  await db.sync({ alter: process.env.NODE_ENV !== 'production' })
  // Columnas e índices nuevos (idempotente, no destructivo) para producción
  await migrateColumns(db)
  console.log('✔ Base de datos conectada')
}
