/**
 * Scripts de mantenimiento de la base de datos.
 *
 *   npm run db:seed            Crea tablas faltantes, categorías y el superusuario
 *   npm run db:clear           Vacía los datos (reportes, votos, denuncias, lista negra, usuarios no admin)
 *                              y borra las imágenes. Conserva categorías y admin.
 *   npm run db:reset           Borra TODAS las tablas y tipos, las vuelve a crear y siembra de nuevo
 *   npm run db:demo            Agrega usuarios y reportes de prueba (para ver gráficas y el PDF)
 *   npm run db:purge-uploads   Borra imágenes huérfanas (que ya no pertenecen a ningún reporte)
 *
 * Pide confirmación. Para saltarla: npm run db:clear -- --yes
 * En NODE_ENV=production se bloquea salvo que agregues --force
 */
import 'reflect-metadata'
import dotenv from 'dotenv'
dotenv.config()
process.env.TZ = process.env.APP_TIMEZONE ?? 'America/Mexico_City'

import fs from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline/promises'
import sharp from 'sharp'
import { Op } from 'sequelize'
import { db } from '../config/db'
import { migrateColumns, migrateEnums } from '../config/migrations'
import { seed } from '../utils/seed'
import { hashPassword } from '../utils/auth'
import { storage, UPLOAD_ROOT } from '../utils/storage'
import { Category } from '../models/Category'
import { User } from '../models/User'
import { Report } from '../models/Report'
import { ReportHistory } from '../models/ReportHistory'
import { ReportVote } from '../models/ReportVote'
import { REPORT_STATUS, SEVERITY, type ReportStatus } from '../models/constants'

const args = process.argv.slice(2)
const command = args[0]
const yes = args.includes('--yes') || args.includes('-y')
const force = args.includes('--force')

const DESTRUCTIVE = ['clear', 'reset', 'demo']

async function confirm(message: string) {
  if (yes) return true
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`${message} Escribe "si" para continuar: `)
  rl.close()
  return answer.trim().toLowerCase() === 'si'
}

async function emptyUploads() {
  const dir = path.join(UPLOAD_ROOT, 'reports')
  await fs.rm(dir, { recursive: true, force: true })
  await fs.mkdir(dir, { recursive: true })
  console.log(`✔ Imágenes eliminadas de ${dir}`)
}

/** Mismo orden que al arrancar la API: ENUM → tablas → columnas/índices */
async function syncSchema() {
  await migrateEnums(db)
  await db.sync({ alter: process.env.NODE_ENV !== 'production' })
  await migrateColumns(db)
}

/* ------------------------------ seed ------------------------------ */
async function cmdSeed() {
  await db.authenticate()
  await syncSchema()
  await seed()
  console.log('✔ Seed completo')
}

/* ------------------------------ clear ----------------------------- */
async function cmdClear() {
  if (!(await confirm('⚠ Se borrarán TODOS los reportes, votos, denuncias, lista negra, usuarios (excepto admin) e imágenes.'))) return
  await db.authenticate()
  await db.transaction(async (t) => {
    await db.query(
      'TRUNCATE TABLE "report_votes", "report_flags", "report_history", "reports", "blacklist" RESTART IDENTITY CASCADE',
      { transaction: t },
    )
    await db.query(`DELETE FROM "users" WHERE "role" <> 'admin'`, { transaction: t })
  })
  await emptyUploads()
  await seed() // asegura que el admin y las categorías sigan ahí
  console.log('✔ Base de datos vaciada (se conservaron categorías y administrador)')
}

/* ------------------------------ reset ----------------------------- */
async function cmdReset() {
  if (!(await confirm('⚠ Se ELIMINARÁN todas las tablas y se crearán de nuevo desde cero.'))) return
  await db.authenticate()
  const qi = db.getQueryInterface()
  await qi.dropAllTables()
  // Los ENUM de Postgres quedan aunque se borren las tablas
  await (qi as unknown as { dropAllEnums?: () => Promise<void> }).dropAllEnums?.()
  await db.sync()
  await emptyUploads()
  await seed()
  console.log('✔ Base de datos reiniciada')
}

/* ------------------------------ demo ------------------------------ */
const rand = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)]
const COLONIAS = ['Centro', 'Del Valle', 'Narvarte', 'Roma Norte', 'Doctores', 'Portales', 'Escandón', 'Juárez', 'Obrera', 'Condesa']
const TITLES: Record<string, string[]> = {
  agua: ['Fuga de agua en la banqueta', 'Sin agua desde hace 3 días', 'Toma de agua rota'],
  drenaje: ['Coladera tapada', 'Brota agua negra del drenaje', 'Registro sin tapa'],
  electricidad: ['Cable de luz caído', 'Transformador echando chispas', 'Apagón en toda la cuadra'],
  alumbrado: ['Luminaria apagada', 'Poste de luz parpadeando', 'Calle sin alumbrado'],
  baches: ['Bache enorme en el carril derecho', 'Banqueta levantada', 'Hundimiento en la calle'],
  basura: ['Tiradero de basura en la esquina', 'No pasa el camión de basura', 'Contenedor desbordado'],
  senalizacion: ['Semáforo descompuesto', 'Señal de alto caída', 'Paso peatonal borrado'],
  'areas-verdes': ['Árbol a punto de caer', 'Parque sin mantenimiento', 'Ramas sobre cables'],
  inundacion: ['Calle inundada tras la lluvia', 'Encharcamiento permanente', 'Paso a desnivel inundado'],
  otro: ['Problema en la vía pública', 'Mobiliario urbano dañado', 'Falla de servicio público'],
}

/** Imagen de prueba: fondo del color de la categoría con su nombre */
async function demoImage(color: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <rect width="100%" height="100%" fill="${color}"/>
    <circle cx="400" cy="260" r="110" fill="rgba(255,255,255,.25)"/>
    <text x="400" y="460" font-family="Arial" font-size="48" font-weight="bold" fill="#fff" text-anchor="middle">${label.replace(/&/g, '&amp;')}</text>
    <text x="400" y="520" font-family="Arial" font-size="26" fill="rgba(255,255,255,.85)" text-anchor="middle">Imagen de demostración</text>
  </svg>`
  return sharp(Buffer.from(svg)).jpeg().toBuffer()
}

async function cmdDemo() {
  const count = Number(args.find((a) => /^\d+$/.test(a)) ?? 60)
  if (!(await confirm(`Se crearán 8 usuarios de prueba y ${count} reportes de demostración.`))) return
  await db.authenticate()
  await syncSchema()
  await seed()

  const categories = await Category.findAll()
  const admin = await User.findOne({ where: { role: 'admin' } })
  const password = await hashPassword('Demo12345')
  const users: User[] = []
  for (let i = 1; i <= 8; i++) {
    const [u] = await User.findOrCreate({
      where: { email: `demo${i}@geoscript.local` },
      defaults: { name: `Ciudadano Demo ${i}`, email: `demo${i}@geoscript.local`, password, confirmed: true, role: i === 1 ? 'moderador' : 'ciudadano' },
    })
    users.push(u)
  }

  const [lat0, lng0] = (process.env.DEMO_CENTER ?? '19.4326,-99.1332').split(',').map(Number)
  const images = new Map<number, { imageUrl: string; thumbUrl: string }>()

  for (let i = 0; i < count; i++) {
    const cat = rand(categories)
    if (!images.has(cat.id)) images.set(cat.id, await storage.saveReportImage(await demoImage(cat.color, cat.name)))
    const author = rand(users)
    const createdAt = new Date(Date.now() - Math.random() * 330 * 864e5)
    // Más probable que los viejos ya estén resueltos
    const ageDays = (Date.now() - createdAt.getTime()) / 864e5
    const status: ReportStatus = ageDays > 60 && Math.random() < 0.6 ? 'resuelto' : rand(REPORT_STATUS)
    const resolvedAt = status === 'resuelto' ? new Date(createdAt.getTime() + (1 + Math.random() * 20) * 864e5) : null

    const report = await Report.create({
      title: rand(TITLES[cat.slug] ?? TITLES.otro),
      description: 'Reporte generado automáticamente para probar el mapa, las gráficas y el informe PDF.',
      categoryId: cat.id,
      severity: rand(SEVERITY),
      status,
      resolvedAt: resolvedAt ? new Date(Math.min(resolvedAt.getTime(), Date.now())) : null,
      lat: lat0 + (Math.random() - 0.5) * 0.08,
      lng: lng0 + (Math.random() - 0.5) * 0.08,
      colonia: rand(COLONIAS),
      calle: `Calle ${Math.ceil(Math.random() * 120)}`,
      anonymous: Math.random() < 0.7,
      userId: author.id,
      ...images.get(cat.id)!,
      createdAt,
    })
    await ReportHistory.create({ reportId: report.id, fromStatus: null, toStatus: 'pendiente', note: 'Reporte creado', changedById: author.id, createdAt })
    if (status !== 'pendiente') {
      await ReportHistory.create({
        reportId: report.id,
        fromStatus: 'pendiente',
        toStatus: status,
        note: 'Actualización de demostración',
        changedById: admin?.id ?? author.id,
        createdAt: report.resolvedAt ?? new Date(createdAt.getTime() + 864e5),
      })
    }
    // Votos de la comunidad
    for (const voter of users) {
      if (voter.id !== author.id && Math.random() < 0.3 && !['resuelto', 'rechazado'].includes(status)) {
        await ReportVote.create({ reportId: report.id, userId: voter.id, value: Math.random() < 0.6 ? 'solucionado' : 'sin_solucion' })
      }
    }
    // Unos cuantos eliminados (borrado lógico)
    if (Math.random() < 0.06) {
      await report.update({ deletedById: author.id })
      await report.destroy()
    }
  }
  console.log(`✔ ${count} reportes de demostración creados. Usuarios: demo1..demo8@geoscript.local / Demo12345 (demo1 es moderador)`)
}

/* -------------------------- purge-uploads ------------------------- */
async function cmdPurgeUploads() {
  await db.authenticate()
  const reports = await Report.findAll({ paranoid: false, attributes: ['imageUrl', 'thumbUrl', 'mediumUrl'] })
  // Las evidencias del seguimiento también viven en /uploads/reports
  const evidence = await ReportHistory.findAll({ attributes: ['imageUrl', 'thumbUrl'], where: { imageUrl: { [Op.ne]: null } } })
  const used = new Set(
    [...reports, ...evidence]
      .flatMap((r) => [r.imageUrl, r.thumbUrl, r instanceof Report ? r.mediumUrl : null])
      .filter((p): p is string => !!p)
      .map((p) => path.basename(p)),
  )
  const dir = path.join(UPLOAD_ROOT, 'reports')
  const files = await fs.readdir(dir).catch(() => [] as string[])
  const orphans = files.filter((f) => !used.has(f))
  for (const f of orphans) await fs.unlink(path.join(dir, f))
  console.log(`✔ ${orphans.length} imágenes huérfanas eliminadas (${files.length - orphans.length} en uso)`)
}

/* ------------------------------------------------------------------ */
const commands: Record<string, () => Promise<void>> = {
  seed: cmdSeed,
  clear: cmdClear,
  reset: cmdReset,
  demo: cmdDemo,
  'purge-uploads': cmdPurgeUploads,
}

async function main() {
  const run = commands[command]
  if (!run) {
    console.log('Uso: ts-node src/scripts/db.ts <seed|clear|reset|demo [cantidad]|purge-uploads> [--yes] [--force]')
    process.exit(1)
  }
  if (process.env.NODE_ENV === 'production' && DESTRUCTIVE.includes(command) && !force) {
    console.error('✖ Estás en producción. Agrega --force si de verdad quieres hacerlo.')
    process.exit(1)
  }
  await run()
  await db.close()
}

main().catch(async (err) => {
  console.error('✖ Error:', err)
  await db.close().catch(() => undefined)
  process.exit(1)
})
