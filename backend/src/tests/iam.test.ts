/**
 * Pruebas de integración del IAM interno (responsables, permisos y auditoría).
 *
 *   npm run test:iam
 *
 * Usan SOLO la base de datos local de pruebas (TEST_DATABASE_URL) y se niegan a correr contra
 * cualquier otra (Render, hosts remotos o NODE_ENV=production). Levantan la API en un puerto
 * aleatorio dentro del mismo proceso. El correo nunca sale: el transporte SMTP se sustituye
 * por uno en memoria y la API de Brevo se simula interceptando fetch hacia api.brevo.com.
 */
import 'reflect-metadata'
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

// ---- Entorno: antes de importar la conexión (dotenv no sobrescribe lo ya definido) ----
process.env.NODE_ENV = 'test'
for (const k of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'BREVO_API_KEY', 'N8N_WEBHOOK_URL', 'DEV_LOG_AUTH_CODES']) process.env[k] = ''
process.env.FRONTEND_URL = 'http://localhost:5173'
process.env.AUTO_ASSIGN_REPORTS = 'false'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useTestDatabase } = require('../scripts/useTestDatabase') as typeof import('../scripts/useTestDatabase')
if (!useTestDatabase()) throw new Error('Define TEST_DATABASE_URL (BD local) para correr las pruebas.')
const dbHost = new URL(process.env.DATABASE_URL!).hostname
if (!['localhost', '127.0.0.1', '::1'].includes(dbHost)) throw new Error(`Las pruebas solo corren contra una BD local (DATABASE_URL apunta a ${dbHost}).`)

/* eslint-disable @typescript-eslint/no-explicit-any */
let base = ''
let server: Server
let M: {
  User: typeof import('../models/User').User
  Area: typeof import('../models/Area').Area
  Category: typeof import('../models/Category').Category
  Report: typeof import('../models/Report').Report
  ReportHistory: typeof import('../models/ReportHistory').ReportHistory
  AuditLog: typeof import('../models/AuditLog').AuditLog
}
let jwt: (id: number) => string
const sentMail: { to: string; html: string }[] = []
const consoleOutput: string[] = []

const run = Date.now().toString(36)
const PASSWORD = 'Prueba-Segura-2026'
const F: Record<string, any> = {}

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data: any = null
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { status: res.status, data }
}

before(async () => {
  // Captura de TODO lo que se escribe (console y también morgan, que escribe directo en stdout):
  // al final se verifica que ningún token aparezca en los logs
  for (const stream of [process.stdout, process.stderr]) {
    const original = stream.write.bind(stream) as (...a: unknown[]) => boolean
    ;(stream as any).write = (chunk: unknown, ...rest: unknown[]) => {
      consoleOutput.push(String(chunk))
      return original(chunk, ...rest)
    }
  }

  const { connectDB } = await import('../config/db')
  const { seed } = await import('../utils/seed')
  const { transporter } = await import('../config/mailer')
  ;(transporter as any).sendMail = async (opts: { to: string; html: string }) => {
    sentMail.push({ to: opts.to, html: opts.html })
    return { messageId: 'memoria' }
  }
  const { hashPassword, generateJWT } = await import('../utils/auth')
  jwt = generateJWT
  M = {
    User: (await import('../models/User')).User,
    Area: (await import('../models/Area')).Area,
    Category: (await import('../models/Category')).Category,
    Report: (await import('../models/Report')).Report,
    ReportHistory: (await import('../models/ReportHistory')).ReportHistory,
    AuditLog: (await import('../models/AuditLog')).AuditLog,
  }
  await connectDB()
  await seed()

  const app = (await import('../server')).default
  server = app.listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  // ---- Datos de prueba (correos únicos por ejecución) ----
  const hash = await hashPassword(PASSWORD)
  const user = (name: string, role: string, extra: Record<string, unknown> = {}) =>
    M.User.create({ name, email: `${name.toLowerCase().replace(/\W+/g, '.')}.${run}@geoscript.test`, password: hash, role, confirmed: true, ...extra })

  F.areaA = await M.Area.create({ name: `Alumbrado prueba ${run}`, slug: `alumbrado-${run}`, type: 'municipal' })
  F.areaB = await M.Area.create({ name: `Agua prueba ${run}`, slug: `agua-${run}`, type: 'organismo' })
  F.areaExt = await M.Area.create({ name: `CFE prueba ${run}`, slug: `cfe-${run}`, type: 'externa' })
  F.category = await M.Category.create({ name: `Categoría ${run}`, slug: `cat-${run}`, color: '#123456' })

  F.admin = await user('Admin Uno', 'admin')
  F.admin2 = await user('Admin Dos', 'admin')
  F.opA = await user('Operativo A', 'operativo', { areaId: F.areaA.id })
  F.opA2 = await user('Operativo A Dos', 'operativo', { areaId: F.areaA.id })
  F.opB = await user('Operativo B', 'operativo', { areaId: F.areaB.id })
  F.opNoArea = await user('Operativo Sin Area', 'operativo', { areaId: null })
  F.moderator = await user('Moderador', 'moderador')
  F.citizen = await user('Ciudadano', 'ciudadano')

  const report = (title: string, areaId: number | null, extra: Record<string, unknown> = {}) =>
    M.Report.create({
      title, description: 'Descripción de prueba suficiente', imageUrl: '/uploads/x.webp', thumbUrl: '/uploads/x.webp',
      lat: 18.88, lng: -97.73, userId: F.citizen.id, categoryId: F.category.id, areaId, status: areaId ? 'asignado' : 'pendiente', ...extra,
    })
  F.rA1 = await report(`A1 ${run}`, F.areaA.id)
  F.rA2 = await report(`A2 ${run}`, F.areaA.id)
  F.rB1 = await report(`B1 ${run}`, F.areaB.id)
  F.rBHidden = await report(`B oculto ${run}`, F.areaB.id, { hidden: true, hiddenReason: 'prueba' })
  F.rNoArea = await report(`Sin area ${run}`, null, { createdAt: new Date(Date.now() - 30 * 864e5) })

  F.t = Object.fromEntries(['admin', 'admin2', 'opA', 'opA2', 'opB', 'opNoArea', 'moderator', 'citizen'].map((k) => [k, jwt(F[k].id)]))
})

after(async () => {
  server?.close()
  const { db } = await import('../config/db')
  await db.close()
})

/* ======================= Alta, edición y estado ======================= */

describe('Alta de responsables', () => {
  test('sin correo configurado: se crea con invitación pendiente y explica qué falta (no finge el envío)', async () => {
    const r = await api('POST', '/admin/staff', F.t.admin, { name: 'Laura Pruebas', email: `laura.${run}@geoscript.test`, role: 'operativo', areaId: F.areaA.id })
    assert.equal(r.status, 201, JSON.stringify(r.data))
    assert.equal(r.data.invitation.sent, false)
    assert.match(r.data.invitation.reason, /SMTP_HOST/)
    assert.equal(r.data.member.status, 'invitacion_pendiente')
    assert.equal(r.data.member.area.id, F.areaA.id)
    // Nada secreto en la respuesta
    const json = JSON.stringify(r.data)
    assert.doesNotMatch(json, /inviteTokenHash|password|"token"/)
    const db = await M.User.scope('withSecrets').findByPk(r.data.member.id)
    assert.ok(db)
    assert.equal(db.confirmed, false)
    assert.match(db.inviteTokenHash ?? '', /^[0-9a-f]{64}$/, 'solo se guarda el hash SHA-256')
    assert.notEqual(db.password, PASSWORD)
    assert.match(db.password, /^\$2[aby]\$/, 'el password inutilizable también va con bcrypt')
    assert.equal(sentMail.length, 0)
    F.laura = db
  })

  test('valida datos: área obligatoria para operativo, no autoridades externas, sin duplicados', async () => {
    const noArea = await api('POST', '/admin/staff', F.t.admin, { name: 'Sin Area', email: `sa.${run}@geoscript.test`, role: 'operativo' })
    assert.equal(noArea.status, 400)
    const ext = await api('POST', '/admin/staff', F.t.admin, { name: 'Externo', email: `ex.${run}@geoscript.test`, role: 'operativo', areaId: F.areaExt.id })
    assert.equal(ext.status, 400)
    const dup = await api('POST', '/admin/staff', F.t.admin, { name: 'Duplicado', email: F.citizen.email, role: 'operativo', areaId: F.areaA.id })
    assert.equal(dup.status, 409)
    assert.equal(dup.data.code, 'EMAIL_EXISTS')
    const badMail = await api('POST', '/admin/staff', F.t.admin, { name: 'Correo Malo', email: 'no-es-correo', role: 'moderador' })
    assert.equal(badMail.status, 400)
  })

  test('no se pueden asignar permisos superiores (rol admin)', async () => {
    const create = await api('POST', '/admin/staff', F.t.admin, { name: 'Quiero Ser Admin', email: `qa.${run}@geoscript.test`, role: 'admin' })
    assert.equal(create.status, 400)
    const patch = await api('PATCH', `/admin/staff/${F.opA2.id}`, F.t.admin, { role: 'admin' })
    assert.equal(patch.status, 400)
    const legacy = await api('PATCH', `/admin/users/${F.citizen.id}/role`, F.t.admin, { role: 'admin' })
    assert.equal(legacy.status, 400)
  })

  test('con correo configurado: la invitación llega, se valida, se acepta una sola vez y permite entrar', async () => {
    Object.assign(process.env, { SMTP_HOST: 'smtp.prueba.local', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'GeoScript <no-reply@municipio.gob.mx>' })
    try {
      const resend = await api('POST', `/admin/staff/${F.laura.id}/invitation`, F.t.admin)
      assert.equal(resend.status, 200, JSON.stringify(resend.data))
      assert.equal(resend.data.invitation.sent, true)
      const mail = sentMail.at(-1)!
      assert.equal(mail.to, F.laura.email)
      const link = /href="([^"]+\/auth\/invitation\?[^"]+)"/.exec(mail.html)?.[1]
      assert.ok(link, 'el correo trae el enlace')
      const url = new URL(link!.replace(/&amp;/g, '&'))
      const token = url.searchParams.get('token')!
      F.inviteToken = token

      const wrong = await api('POST', '/auth/invitation/validate', undefined, { email: F.laura.email, token: 'x'.repeat(43) })
      assert.equal(wrong.status, 401)
      const ok = await api('POST', '/auth/invitation/validate', undefined, { email: F.laura.email, token })
      assert.equal(ok.status, 200)
      assert.equal(ok.data.name, 'Laura Pruebas')

      const weak = await api('POST', '/auth/invitation/accept', undefined, { email: F.laura.email, token, password: 'corta', password_confirmation: 'corta' })
      assert.equal(weak.status, 400)
      const accept = await api('POST', '/auth/invitation/accept', undefined, { email: F.laura.email, token, password: PASSWORD, password_confirmation: PASSWORD })
      assert.equal(accept.status, 200, JSON.stringify(accept.data))
      const again = await api('POST', '/auth/invitation/accept', undefined, { email: F.laura.email, token, password: PASSWORD, password_confirmation: PASSWORD })
      assert.equal(again.status, 401, 'el enlace es de un solo uso')

      const login = await api('POST', '/auth/login', undefined, { email: F.laura.email, password: PASSWORD })
      assert.equal(login.status, 200)
      F.t.laura = login.data.token
      const me = await api('GET', '/auth/user', F.t.laura)
      assert.equal(me.data.role, 'operativo')
      assert.equal(me.data.areaId, F.areaA.id)
      assert.equal(me.data.inviteTokenHash, undefined)
    } finally {
      for (const k of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']) process.env[k] = ''
    }
  })

  test('editar datos registra la fecha de modificación y la auditoría', async () => {
    const before = (await M.User.findByPk(F.laura.id))!.updatedAt
    await new Promise((r) => setTimeout(r, 15))
    const r = await api('PATCH', `/admin/staff/${F.laura.id}`, F.t.admin, { name: 'Laura Pruebas Gómez' })
    assert.equal(r.status, 200, JSON.stringify(r.data))
    assert.equal(r.data.member.name, 'Laura Pruebas Gómez')
    assert.ok(new Date(r.data.member.updatedAt) > before)
    const email = await api('PATCH', `/admin/staff/${F.laura.id}`, F.t.admin, { email: `otro.${run}@geoscript.test` })
    assert.equal(email.status, 400, 'el correo de una cuenta activa no se cambia')
    const log = await M.AuditLog.findOne({ where: { action: 'staff.updated', targetId: F.laura.id }, order: [['id', 'DESC']] })
    assert.deepEqual((log!.details as any).changes.name, { from: 'Laura Pruebas', to: 'Laura Pruebas Gómez' })
    assert.equal(log!.actorId, F.admin.id)
  })
})

/* ======================= Asignación y reasignación ======================= */

describe('Responsable directo y reasignación', () => {
  test('el admin asigna un reporte a personal del área; no a personal de otra área', async () => {
    const ok = await api('PATCH', `/attention/reports/${F.rA1.id}/assign`, F.t.admin, { areaId: F.areaA.id, assigneeId: F.laura.id })
    assert.equal(ok.status, 200, JSON.stringify(ok.data))
    const bad = await api('PATCH', `/attention/reports/${F.rA2.id}/assign`, F.t.admin, { areaId: F.areaA.id, assigneeId: F.opB.id })
    assert.equal(bad.status, 400)
    const ok2 = await api('PATCH', `/attention/reports/${F.rA2.id}/assign`, F.t.admin, { areaId: F.areaA.id, assigneeId: F.laura.id })
    assert.equal(ok2.status, 200)
  })

  test('"asignados a mí" y el conteo de la ficha', async () => {
    const mine = await api('GET', '/attention/reports?assignee=me&open=true', F.t.laura)
    assert.equal(mine.status, 200)
    assert.deepEqual(mine.data.data.map((r: any) => r.id).sort(), [F.rA1.id, F.rA2.id].sort())
    assert.equal(mine.data.data[0].assignee.id, F.laura.id)
    const detail = await api('GET', `/admin/staff/${F.laura.id}`, F.t.admin)
    assert.equal(detail.data.openAssigned, 2)
  })

  test('reasignar a otra área se rechaza; a un compañero de la misma área funciona y queda en el historial', async () => {
    const other = await api('POST', `/admin/staff/${F.laura.id}/reassign`, F.t.admin, { toUserId: F.opB.id })
    assert.equal(other.status, 400)
    const ok = await api('POST', `/admin/staff/${F.laura.id}/reassign`, F.t.admin, { toUserId: F.opA2.id })
    assert.equal(ok.status, 200, JSON.stringify(ok.data))
    assert.equal((await M.Report.findByPk(F.rA1.id))!.assigneeId, F.opA2.id)
    const history = await M.ReportHistory.count({ where: { reportId: F.rA1.id, kind: 'asignacion' } })
    assert.ok(history >= 2)
  })

  test('cambiar de área devuelve sus reportes abiertos a la bandeja general', async () => {
    const r = await api('PATCH', `/admin/staff/${F.opA2.id}`, F.t.admin, { areaId: F.areaB.id })
    assert.equal(r.status, 200, JSON.stringify(r.data))
    assert.equal(r.data.releasedReports, 2)
    assert.equal((await M.Report.findByPk(F.rA1.id))!.assigneeId, null)
    // Lo regresamos para las demás pruebas
    await api('PATCH', `/admin/staff/${F.opA2.id}`, F.t.admin, { areaId: F.areaA.id })
  })
})

/* ======================= Activación / desactivación ======================= */

describe('Activar y desactivar cuentas', () => {
  test('desactivar corta el acceso de inmediato (aunque el JWT siga vigente) y conserva el historial', async () => {
    await api('PATCH', `/attention/reports/${F.rA1.id}/assign`, F.t.admin, { areaId: F.areaA.id, assigneeId: F.laura.id })
    const note = await api('POST', `/attention/reports/${F.rA1.id}/updates`, F.t.laura, { note: 'Revisión en sitio' })
    assert.equal(note.status, 201)

    const off = await api('PATCH', `/admin/staff/${F.laura.id}/status`, F.t.admin, { active: false })
    assert.equal(off.status, 200, JSON.stringify(off.data))
    assert.equal(off.data.releasedReports, 1)
    assert.equal(off.data.member.status, 'desactivado')

    const session = await api('GET', '/auth/user', F.t.laura)
    assert.equal(session.status, 403)
    assert.equal(session.data.code, 'INACTIVE')
    const login = await api('POST', '/auth/login', undefined, { email: F.laura.email, password: PASSWORD })
    assert.equal(login.status, 403)
    assert.equal(login.data.code, 'INACTIVE')
    const wrongPass = await api('POST', '/auth/login', undefined, { email: F.laura.email, password: 'incorrecta-123' })
    assert.equal(wrongPass.status, 401, 'no revela el estado si el password es incorrecto')

    // El usuario y su trabajo siguen en la BD
    assert.ok(await M.User.findByPk(F.laura.id))
    assert.ok((await M.ReportHistory.count({ where: { changedById: F.laura.id } })) >= 1)
    const activity = await api('GET', `/admin/staff/${F.laura.id}/activity`, F.t.admin)
    const actions = activity.data.audit.map((a: any) => a.action)
    for (const a of ['staff.created', 'invitation.not_sent', 'invitation.sent', 'invitation.accepted', 'staff.updated', 'staff.deactivated']) {
      assert.ok(actions.includes(a), `falta ${a} en la auditoría`)
    }
    assert.ok(activity.data.attention.length >= 1)

    const on = await api('PATCH', `/admin/staff/${F.laura.id}/status`, F.t.admin, { active: true })
    assert.equal(on.status, 200)
    assert.equal((await api('GET', '/auth/user', F.t.laura)).status, 200)
  })

  test('un administrador no puede desactivarse ni cambiar su propio rol', async () => {
    const self = await api('PATCH', `/admin/staff/${F.admin.id}/status`, F.t.admin, { active: false })
    assert.equal(self.status, 403)
    const role = await api('PATCH', `/admin/staff/${F.admin.id}`, F.t.admin, { role: 'moderador' })
    assert.equal(role.status, 403)
    const otherAdminRole = await api('PATCH', `/admin/staff/${F.admin2.id}`, F.t.admin, { role: 'moderador' })
    assert.equal(otherAdminRole.status, 403)
  })

  test('nunca queda la plataforma sin un administrador activo (desactivación cruzada simultánea)', async () => {
    // Solo dejamos activos a admin y admin2 para esta prueba
    const others = await M.User.findAll({ where: { role: 'admin', active: true } })
    const parked = others.filter((u) => u.id !== F.admin.id && u.id !== F.admin2.id)
    for (const u of parked) await u.update({ active: false })
    try {
      const [a, b] = await Promise.all([
        api('PATCH', `/admin/staff/${F.admin2.id}/status`, F.t.admin, { active: false }),
        api('PATCH', `/admin/staff/${F.admin.id}/status`, F.t.admin2, { active: false }),
      ])
      const statuses = [a.status, b.status].sort()
      assert.ok(statuses.includes(200), JSON.stringify([a.data, b.data]))
      assert.ok(statuses.some((s) => s === 409 || s === 403), JSON.stringify([a.data, b.data]))
      assert.ok((await M.User.count({ where: { role: 'admin', active: true } })) >= 1)
    } finally {
      await M.User.update({ active: true }, { where: { id: [F.admin.id, F.admin2.id, ...parked.map((u) => u.id)] } })
    }
  })
})

/* ======================= Permisos por rol y por área ======================= */

describe('Matriz de permisos (backend)', () => {
  test('solo la administración gestiona responsables', async () => {
    for (const who of ['opA', 'moderator', 'citizen']) {
      assert.equal((await api('GET', '/admin/staff', F.t[who])).status, 403, who)
      assert.equal((await api('POST', '/admin/staff', F.t[who], { name: 'X Y Z', email: `x.${who}.${run}@geoscript.test`, role: 'moderador' })).status, 403, who)
    }
    assert.equal((await api('GET', '/admin/staff')).status, 401)
  })

  test('el operativo solo ve su área aunque mande otro ?area= en la petición', async () => {
    const r = await api('GET', `/attention/reports?area=${F.areaB.id}&limit=100`, F.t.opA)
    assert.equal(r.status, 200)
    assert.ok(r.data.data.length > 0)
    assert.ok(r.data.data.every((x: any) => x.area?.id === F.areaA.id), 'solo reportes del área A')
    const summary = await api('GET', `/attention/summary?area=${F.areaB.id}`, F.t.opA)
    assert.equal(summary.data.area.id, F.areaA.id)
  })

  test('el operativo no puede actuar sobre reportes de otra área (404, sin revelar que existen)', async () => {
    assert.equal((await api('PATCH', `/attention/reports/${F.rB1.id}/status`, F.t.opA, { status: 'en_proceso' })).status, 404)
    assert.equal((await api('POST', `/attention/reports/${F.rB1.id}/updates`, F.t.opA, { note: 'intento' })).status, 404)
    assert.equal((await api('PATCH', `/attention/reports/${F.rB1.id}/assign`, F.t.opA, { areaId: F.areaA.id })).status, 403)
    assert.equal((await api('GET', `/reports/${F.rBHidden.id}`, F.t.opA)).status, 404, 'reporte oculto de otra área')
    const detail = await api('GET', `/reports/${F.rB1.id}`, F.t.opA)
    assert.equal(detail.data.canManage, false)
    assert.equal(detail.data.assignee, null)
  })

  test('el operativo sin área no ve reportes (incluidos los estancados sin área)', async () => {
    const list = await api('GET', '/attention/reports', F.t.opNoArea)
    assert.equal(list.data.total, 0)
    const stale = await api('GET', '/attention/stale?days=1', F.t.opNoArea)
    assert.equal(stale.status, 200)
    assert.equal(stale.data.total, 0, 'antes recibía los reportes sin área de todo el municipio')
  })

  test('el ciudadano no entra a la bandeja ni a la administración, y ve sus reportes', async () => {
    assert.equal((await api('GET', '/attention/reports', F.t.citizen)).status, 403)
    assert.equal((await api('GET', '/admin/stats', F.t.citizen)).status, 403)
    const mine = await api('GET', '/reports/mine', F.t.citizen)
    assert.equal(mine.status, 200)
    assert.ok(mine.data.every((r: any) => r.isOwner))
    assert.ok(mine.data.every((r: any) => r.assignee === null), 'el responsable es dato interno')
  })

  test('el moderador no asigna reportes ni gestiona personal', async () => {
    assert.equal((await api('PATCH', `/attention/reports/${F.rA1.id}/assign`, F.t.moderator, { areaId: F.areaB.id })).status, 403)
  })
})

/* ======================= Invitaciones por la API de Brevo (simulada) ======================= */

const FAKE_BREVO_KEY = `xkeysib-${'0'.repeat(64)}-PRUEBAsoloLOCAL0`

describe('Invitaciones con Brevo', () => {
  const brevoCalls: { url: string; headers: Record<string, string>; body: any }[] = []
  let reply: { status: number; body: unknown } = { status: 201, body: { messageId: '<prueba@brevo>' } }
  const realFetch = globalThis.fetch

  before(() => {
    Object.assign(process.env, { BREVO_API_KEY: FAKE_BREVO_KEY, MAIL_FROM: 'GeoScript <avisos@municipio.gob.mx>' })
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = String(input)
      if (!url.startsWith('https://api.brevo.com/')) return realFetch(input, init)
      brevoCalls.push({ url, headers: init?.headers ?? {}, body: init?.body ? JSON.parse(init.body) : null })
      return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
  })
  after(() => {
    globalThis.fetch = realFetch
    for (const k of ['BREVO_API_KEY', 'MAIL_FROM']) process.env[k] = ''
  })

  test('Brevo rechaza el remitente: la cuenta queda pendiente y se explica el motivo sin exponer la clave', async () => {
    reply = { status: 400, body: { code: 'invalid_parameter', message: 'Sender is not valid' } }
    const r = await api('POST', '/admin/staff', F.t.admin, { name: 'Bruno Brevo', email: `bruno.${run}@geoscript.test`, role: 'moderador' })
    assert.equal(r.status, 201, JSON.stringify(r.data))
    assert.equal(r.data.invitation.sent, false)
    assert.match(r.data.invitation.reason, /remitente/)
    assert.equal(r.data.member.status, 'invitacion_pendiente')
    assert.doesNotMatch(JSON.stringify(r.data), new RegExp(FAKE_BREVO_KEY))
    const log = await M.AuditLog.findOne({ where: { action: 'invitation.not_sent', targetId: r.data.member.id } })
    assert.equal((log!.details as any).failure, 'sender_not_verified')
    assert.equal((log!.details as any).provider, 'brevo')
    F.bruno = r.data.member

    reply = { status: 401, body: { code: 'unauthorized', message: 'Key not found' } }
    const badKey = await api('POST', `/admin/staff/${F.bruno.id}/invitation`, F.t.admin)
    assert.equal(badKey.data.invitation.sent, false)
    assert.match(badKey.data.invitation.reason, /clave de API/)
  })

  test('Brevo acepta: usa la API oficial, el enlace funciona, vence en 72 h y es de un solo uso', async () => {
    reply = { status: 201, body: { messageId: '<prueba@brevo>' } }
    const before = brevoCalls.length
    const r = await api('POST', `/admin/staff/${F.bruno.id}/invitation`, F.t.admin)
    assert.equal(r.status, 200, JSON.stringify(r.data))
    assert.equal(r.data.invitation.sent, true)
    assert.equal(r.data.invitation.warning, null)

    const call = brevoCalls.at(-1)!
    assert.equal(brevoCalls.length, before + 1)
    assert.equal(call.url, 'https://api.brevo.com/v3/smtp/email')
    assert.equal(call.headers['api-key'], FAKE_BREVO_KEY, 'la clave solo viaja en la cabecera')
    assert.deepEqual(call.body.sender, { name: 'GeoScript', email: 'avisos@municipio.gob.mx' })
    assert.deepEqual(call.body.to, [{ email: F.bruno.email, name: 'Bruno Brevo' }])
    assert.match(call.body.subject, /Activa tu cuenta/)

    const link = /href="([^"]+\/auth\/invitation\?[^"]+)"/.exec(call.body.htmlContent)?.[1]
    assert.ok(link, 'el correo trae el enlace')
    const url = new URL(link!.replace(/&amp;/g, '&'))
    assert.equal(url.origin, 'http://localhost:5173')
    assert.equal(url.searchParams.get('email'), F.bruno.email)
    const token = url.searchParams.get('token')!
    F.brevoToken = token

    const db = await M.User.scope('withSecrets').findByPk(F.bruno.id)
    const hours = (db!.inviteExpiresAt!.getTime() - Date.now()) / 36e5
    assert.ok(hours > 71.9 && hours <= 72, `vigencia de 72 h (fue ${hours.toFixed(2)})`)

    const ok = await api('POST', '/auth/invitation/accept', undefined, { email: F.bruno.email, token, password: PASSWORD, password_confirmation: PASSWORD })
    assert.equal(ok.status, 200, JSON.stringify(ok.data))
    const again = await api('POST', '/auth/invitation/validate', undefined, { email: F.bruno.email, token })
    assert.equal(again.status, 401, 'el enlace es de un solo uso')
    const login = await api('POST', '/auth/login', undefined, { email: F.bruno.email, password: PASSWORD })
    assert.equal(login.status, 200)
  })

  test('un enlace anterior deja de servir al reenviar la invitación', async () => {
    reply = { status: 201, body: { messageId: '<a@brevo>' } }
    const c = await api('POST', '/admin/staff', F.t.admin, { name: 'Celia Reenvío', email: `celia.${run}@geoscript.test`, role: 'moderador' })
    const first = new URL(/href="([^"]+)"/.exec(brevoCalls.at(-1)!.body.htmlContent)![1].replace(/&amp;/g, '&')).searchParams.get('token')!
    await api('POST', `/admin/staff/${c.data.member.id}/invitation`, F.t.admin)
    const second = new URL(/href="([^"]+)"/.exec(brevoCalls.at(-1)!.body.htmlContent)![1].replace(/&amp;/g, '&')).searchParams.get('token')!
    assert.notEqual(first, second)
    assert.equal((await api('POST', '/auth/invitation/validate', undefined, { email: c.data.member.email, token: first })).status, 401)
    assert.equal((await api('POST', '/auth/invitation/validate', undefined, { email: c.data.member.email, token: second })).status, 200)
  })
})

/* ======================= Secretos fuera de los logs ======================= */

test('ningún token de invitación ni la clave de Brevo aparecen en la consola', () => {
  assert.ok(F.inviteToken)
  const all = consoleOutput.join('\n')
  assert.ok(!all.includes(F.inviteToken), 'el token de invitación apareció en los logs')
  assert.ok(F.brevoToken && !all.includes(F.brevoToken), 'el token enviado por Brevo apareció en los logs')
  assert.ok(!all.includes(FAKE_BREVO_KEY), 'la clave de Brevo apareció en los logs')
})
