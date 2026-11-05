import { Category } from '../models/Category'
import { User } from '../models/User'
import { Area } from '../models/Area'
import type { AreaType } from '../models/constants'
import { hashPassword } from './auth'

const CATEGORIES = [
  { slug: 'agua', name: 'Agua y fugas', color: '#0ea5e9', description: 'Fugas, falta de agua, tomas dañadas' },
  { slug: 'drenaje', name: 'Drenaje y alcantarillado', color: '#6366f1', description: 'Coladeras tapadas, aguas negras, registros abiertos' },
  { slug: 'electricidad', name: 'Electricidad', color: '#eab308', description: 'Cables caídos, apagones, transformadores' },
  { slug: 'alumbrado', name: 'Alumbrado público', color: '#f59e0b', description: 'Luminarias apagadas o dañadas' },
  { slug: 'baches', name: 'Baches y vialidad', color: '#78716c', description: 'Baches, banquetas y calles dañadas' },
  { slug: 'basura', name: 'Basura y recolección', color: '#22c55e', description: 'Tiraderos, recolección que no pasa' },
  { slug: 'senalizacion', name: 'Semáforos y señalización', color: '#ef4444', description: 'Semáforos fallando, señales caídas' },
  { slug: 'areas-verdes', name: 'Árboles y áreas verdes', color: '#16a34a', description: 'Árboles caídos, parques descuidados' },
  { slug: 'inundacion', name: 'Inundaciones', color: '#0284c7', description: 'Encharcamientos e inundaciones' },
  { slug: 'otro', name: 'Otro', color: '#64748b', description: 'Cualquier otra falla de servicios públicos' },
]

/**
 * Áreas iniciales de ejemplo. Son solo un punto de partida: el administrador
 * puede renombrarlas, cambiar su tipo, desactivarlas o crear otras desde el panel.
 */
const AREAS: { slug: string; name: string; type: AreaType; description: string }[] = [
  { slug: 'atencion-ciudadana', name: 'Atención Ciudadana', type: 'municipal', description: 'Recepción, validación y canalización de reportes' },
  { slug: 'alumbrado', name: 'Alumbrado Público', type: 'municipal', description: 'Luminarias y alumbrado en vía pública' },
  { slug: 'obras-publicas', name: 'Obras Públicas y Mantenimiento Urbano', type: 'municipal', description: 'Baches, banquetas y calles dañadas' },
  { slug: 'limpia', name: 'Servicios Públicos – Limpia', type: 'municipal', description: 'Recolección de basura y limpieza' },
  { slug: 'agua-potable', name: 'Organismo Operador de Agua Potable', type: 'organismo', description: 'Agua potable, fugas y drenaje' },
  { slug: 'parques-jardines', name: 'Parques y Jardines', type: 'municipal', description: 'Árboles y áreas verdes' },
  { slug: 'vialidad', name: 'Vialidad y Tránsito', type: 'municipal', description: 'Semáforos y señalización' },
  { slug: 'proteccion-civil', name: 'Protección Civil', type: 'municipal', description: 'Inundaciones y riesgos' },
  { slug: 'cfe', name: 'Comisión Federal de Electricidad (CFE)', type: 'externa', description: 'Red eléctrica, cables y transformadores (autoridad federal)' },
]

/** Mapeo inicial categoría → área. Solo se aplica a categorías que aún no tienen área */
const DEFAULT_ROUTING: Record<string, string> = {
  agua: 'agua-potable',
  drenaje: 'agua-potable',
  electricidad: 'cfe',
  alumbrado: 'alumbrado',
  baches: 'obras-publicas',
  basura: 'limpia',
  senalizacion: 'vialidad',
  'areas-verdes': 'parques-jardines',
  inundacion: 'proteccion-civil',
  // 'otro' se queda sin área: Atención Ciudadana lo clasifica manualmente
}

export async function seed() {
  // Categorías: solo se crean si faltan; no se sobrescriben las ediciones del admin
  for (const cat of CATEGORIES) {
    await Category.findOrCreate({ where: { slug: cat.slug }, defaults: cat })
  }

  // Áreas: solo la primera vez (si la tabla está vacía) para respetar la configuración del admin
  if ((await Area.count()) === 0) {
    const created = await Area.bulkCreate(AREAS)
    const bySlug = new Map(created.map((a) => [a.slug, a.id]))
    for (const [catSlug, areaSlug] of Object.entries(DEFAULT_ROUTING)) {
      await Category.update({ areaId: bySlug.get(areaSlug) ?? null }, { where: { slug: catSlug, areaId: null } })
    }
    console.log(`✔ ${created.length} áreas iniciales creadas (edítalas en Administración → Áreas)`)
  }

  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn('⚠ ADMIN_EMAIL / ADMIN_PASSWORD no definidos: no se creó el superusuario')
    return
  }
  const admin = await User.findOne({ where: { email: ADMIN_EMAIL.toLowerCase() } })
  if (!admin) {
    await User.create({
      name: ADMIN_NAME ?? 'Administrador',
      email: ADMIN_EMAIL.toLowerCase(),
      password: await hashPassword(ADMIN_PASSWORD),
      role: 'admin',
      confirmed: true,
    })
    console.log(`✔ Superusuario creado: ${ADMIN_EMAIL}`)
  } else if (admin.role !== 'admin' || !admin.confirmed || admin.banned) {
    await admin.update({ role: 'admin', confirmed: true, banned: false })
  }
}
