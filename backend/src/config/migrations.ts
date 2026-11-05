import type { Sequelize } from 'sequelize-typescript'

/**
 * Migraciones idempotentes y NO destructivas.
 *
 * En producción `sync()` corre sin `alter`, así que solo crea tablas nuevas (p. ej. `areas`)
 * pero no agrega columnas a tablas existentes. Estas sentencias cubren ese hueco:
 * solo AGREGAN valores de ENUM, columnas nullable e índices. Nunca borran ni renombran.
 * Se pueden ejecutar todas las veces que sea necesario.
 */

/** Valores nuevos de ENUM. Deben existir antes de sync() y fuera de una transacción */
const ENUM_VALUES: [type: string, value: string][] = [
  ['enum_users_role', 'operativo'],
  ...['asignado', 'cerrado', 'canalizado'].flatMap((v) => [
    ['enum_reports_status', v] as [string, string],
    ['enum_report_history_fromStatus', v] as [string, string],
    ['enum_report_history_toStatus', v] as [string, string],
  ]),
]

/** Columnas nuevas (todas opcionales o con valor por defecto) */
const COLUMNS = [
  `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "areaId" INTEGER REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "areaId" INTEGER REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "areaId" INTEGER REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "assignedById" INTEGER`,
  `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "mediumUrl" VARCHAR(255)`,
  `ALTER TABLE "report_history" ADD COLUMN IF NOT EXISTS "kind" VARCHAR(20) NOT NULL DEFAULT 'estado'`,
  `ALTER TABLE "report_history" ADD COLUMN IF NOT EXISTS "internal" BOOLEAN DEFAULT false`,
  `ALTER TABLE "report_history" ADD COLUMN IF NOT EXISTS "imageUrl" VARCHAR(255)`,
  `ALTER TABLE "report_history" ADD COLUMN IF NOT EXISTS "thumbUrl" VARCHAR(255)`,
  `ALTER TABLE "report_history" ADD COLUMN IF NOT EXISTS "fromAreaId" INTEGER REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "report_history" ADD COLUMN IF NOT EXISTS "toAreaId" INTEGER REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  // Ampliar un VARCHAR no pierde datos
  `ALTER TABLE "report_history" ALTER COLUMN "note" TYPE VARCHAR(600)`,
]

/**
 * Índices para las consultas más frecuentes. Postgres NO indexa las llaves foráneas
 * automáticamente: sin estos, "mis reportes", la bandeja por área y el historial
 * recorren la tabla completa.
 */
const INDEXES = [
  `CREATE INDEX IF NOT EXISTS "reports_user_id" ON "reports" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "reports_category_id" ON "reports" ("categoryId")`,
  `CREATE INDEX IF NOT EXISTS "reports_area_status" ON "reports" ("areaId", "status")`,
  `CREATE INDEX IF NOT EXISTS "reports_created_at" ON "reports" ("createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "reports_status_hidden" ON "reports" ("status", "hidden")`,
  `CREATE INDEX IF NOT EXISTS "report_history_report_id" ON "report_history" ("reportId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "report_flags_report_id" ON "report_flags" ("reportId", "status")`,
  `CREATE INDEX IF NOT EXISTS "users_area_id" ON "users" ("areaId")`,
]

async function typeExists(db: Sequelize, name: string) {
  const [rows] = await db.query(`SELECT 1 FROM pg_type WHERE typname = :name`, { replacements: { name } })
  return rows.length > 0
}

async function tableExists(db: Sequelize, name: string) {
  const [rows] = await db.query(`SELECT to_regclass(:name) AS t`, { replacements: { name: `public."${name}"` } })
  return !!(rows[0] as { t: string | null }).t
}

/** Antes de sync(): agrega valores a los ENUM existentes (en una BD nueva no hace nada) */
export async function migrateEnums(db: Sequelize) {
  for (const [type, value] of ENUM_VALUES) {
    if (!(await typeExists(db, type))) continue
    await db.query(`ALTER TYPE "${type}" ADD VALUE IF NOT EXISTS '${value}'`)
  }
}

/** Después de sync(): columnas e índices que sync() sin alter no crea */
export async function migrateColumns(db: Sequelize) {
  if (!(await tableExists(db, 'reports'))) return
  for (const sql of [...COLUMNS, ...INDEXES]) await db.query(sql)
}
