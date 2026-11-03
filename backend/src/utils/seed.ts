import { Category } from '../models/Category'
import { User } from '../models/User'
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

export async function seed() {
  for (const cat of CATEGORIES) {
    const [row, created] = await Category.findOrCreate({ where: { slug: cat.slug }, defaults: cat })
    if (!created) await row.update(cat)
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
