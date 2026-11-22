/**
 * Cuentas de prueba (administrador, personal operativo y ciudadano) para recorrer
 * el seguimiento de reportes de principio a fin.
 *
 *   npm run db:test-users                     Crea las cuentas que falten
 *   npm run db:test-users -- --reset-passwords Además vuelve a poner el password del .env
 *                                              a las cuentas de prueba que ya existan
 *   npm run db:test-users -- --sync-roles      Corrige rol / área de una cuenta de prueba existente
 *
 * Lee las credenciales de backend/.env (TEST_ADMIN_*, TEST_OPERATOR_*, TEST_CITIZEN_*).
 * Usa TEST_DATABASE_URL (BD local) si está definida; si no, DATABASE_URL.
 *
 * Seguridad:
 * - Idempotente: si el correo ya existe no se duplica ni se toca su password.
 * - Los password se guardan con el mismo bcrypt que el registro normal (hashPassword).
 * - Nunca corre con NODE_ENV=production ni contra una base de datos de Render.
 * - Solo acepta bases de datos locales salvo que se pase --allow-remote (y aun así nunca Render).
 */
import 'reflect-metadata'
import { useTestDatabase } from './useTestDatabase'
// Si TEST_DATABASE_URL está definida se usa en lugar de DATABASE_URL (que suele ser Render)
const usingTestDb = useTestDatabase()
process.env.TZ = process.env.APP_TIMEZONE ?? 'America/Mexico_City'

const args = process.argv.slice(2)
const resetPasswords = args.includes('--reset-passwords')
const syncRoles = args.includes('--sync-roles')
const allowRemote = args.includes('--allow-remote')

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal', 'postgres', 'db']

/** Se valida ANTES de importar la conexión: no se abre ninguna conexión a una BD no permitida */
function assertSafeDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NODE_ENV=production: los usuarios de prueba no se crean en producción.')
  }
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Falta DATABASE_URL.')
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    throw new Error('DATABASE_URL no es una URL válida.')
  }
  if (host.endsWith('render.com') || host.startsWith('dpg-')) {
    throw new Error(
      `DATABASE_URL apunta a Render (${host}). Los usuarios de prueba solo se crean en una base de datos local.\n` +
        '  Ejemplo: DATABASE_URL=postgresql://geoscript:geoscript_local@localhost:55432/geoscript_test DATABASE_SSL=false npm run db:test-users',
    )
  }
  if (!LOCAL_HOSTS.includes(host) && !allowRemote) {
    throw new Error(`DATABASE_URL apunta a "${host}", que no es local. Si es una BD de pruebas, agrega --allow-remote.`)
  }
  return host
}

type Spec = { key: string; label: string; role: 'admin' | 'operativo' | 'ciudadano'; name: string; email?: string; password?: string }

function readSpecs(): Spec[] {
  const env = process.env
  return [
    { key: 'TEST_ADMIN', label: 'Administrador', role: 'admin', name: env.TEST_ADMIN_NAME || 'Admin de Prueba', email: env.TEST_ADMIN_EMAIL, password: env.TEST_ADMIN_PASSWORD },
    { key: 'TEST_OPERATOR', label: 'Personal operativo', role: 'operativo', name: env.TEST_OPERATOR_NAME || 'Operativo de Prueba', email: env.TEST_OPERATOR_EMAIL, password: env.TEST_OPERATOR_PASSWORD },
    { key: 'TEST_CITIZEN', label: 'Ciudadano', role: 'ciudadano', name: env.TEST_CITIZEN_NAME || 'Ciudadano de Prueba', email: env.TEST_CITIZEN_EMAIL, password: env.TEST_CITIZEN_PASSWORD },
  ]
}

function validate(specs: Spec[]) {
  const errors: string[] = []
  for (const s of specs) {
    if (!s.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) errors.push(`${s.key}_EMAIL falta o no es un correo válido`)
    if (!s.password || s.password.length < 8) errors.push(`${s.key}_PASSWORD falta o tiene menos de 8 caracteres`)
  }
  const emails = specs.map((s) => s.email?.toLowerCase())
  if (new Set(emails).size !== emails.length) errors.push('Los tres correos de prueba deben ser distintos')
  if (errors.length) throw new Error(`Revisa backend/.env:\n  - ${errors.join('\n  - ')}`)
}

async function main() {
  const host = assertSafeDatabase()
  const specs = readSpecs()
  validate(specs)

  // Import diferido: la conexión solo se crea después de validar que la BD es segura
  const { db } = await import('../config/db')
  const { migrateColumns, migrateEnums } = await import('../config/migrations')
  const { seed } = await import('../utils/seed')
  const { hashPassword } = await import('../utils/auth')
  const { User } = await import('../models/User')
  const { Area } = await import('../models/Area')

  try {
    await db.authenticate()
    // Mismo orden que al arrancar la API: ENUM → tablas → columnas/índices → categorías y áreas
    await migrateEnums(db)
    await db.sync({ alter: true })
    await migrateColumns(db)
    await seed()

    const areaSlug = process.env.TEST_OPERATOR_AREA || 'obras-publicas'
    const area = await Area.findOne({ where: { slug: areaSlug } })
    if (!area) {
      const slugs = (await Area.findAll({ attributes: ['slug'] })).map((a) => a.slug).join(', ')
      throw new Error(`TEST_OPERATOR_AREA="${areaSlug}" no existe. Áreas disponibles: ${slugs}`)
    }
    if (area.type === 'externa') throw new Error(`El área "${area.name}" es externa: el personal operativo debe pertenecer a un área municipal u organismo.`)

    console.log(`\nBase de datos: ${host}${usingTestDb ? ' (TEST_DATABASE_URL)' : ''}`)
    for (const s of specs) {
      const email = s.email!.toLowerCase()
      const areaId = s.role === 'operativo' ? area.id : null
      const existing = await User.findOne({ where: { email } })

      if (!existing) {
        await User.create({ name: s.name, email, password: await hashPassword(s.password!), role: s.role, areaId, confirmed: true })
        console.log(`✔ ${s.label}: ${email} creado${s.role === 'operativo' ? ` (área: ${area.name})` : ''}`)
        continue
      }

      const changes: Record<string, unknown> = {}
      const roleMismatch = existing.role !== s.role || (existing.areaId ?? null) !== areaId
      if (roleMismatch) {
        if (syncRoles) Object.assign(changes, { role: s.role, areaId })
        else console.warn(`⚠ ${s.label}: ${email} ya existe con rol "${existing.role}"${existing.areaId ? ` (área ${existing.areaId})` : ''}. No se modificó; usa --sync-roles para corregirlo.`)
      }
      if (resetPasswords) changes.password = await hashPassword(s.password!)
      if (!existing.confirmed) changes.confirmed = true

      if (Object.keys(changes).length) {
        await existing.update(changes)
        console.log(`✔ ${s.label}: ${email} actualizado (${Object.keys(changes).map((k) => (k === 'password' ? 'password restablecido' : k)).join(', ')})`)
      } else if (!roleMismatch) {
        console.log(`• ${s.label}: ${email} ya existe (sin cambios; su password no se modificó)`)
      }
    }
    console.log('\nInicia sesión con los correos y passwords definidos en backend/.env (TEST_*).')
  } finally {
    await db.close().catch(() => undefined)
  }
}

main().catch((err) => {
  console.error(`✖ ${err instanceof Error ? err.message : err}`)
  process.exit(1)
})
