import type { Request, Response } from 'express'
import { fn, col } from 'sequelize'
import { Area } from '../models/Area'
import { Category } from '../models/Category'
import { Report } from '../models/Report'
import { User } from '../models/User'
import { OPEN_STATUSES } from '../models/constants'

/** "Obras Públicas y Mantenimiento" → "obras-publicas-y-mantenimiento" */
export const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'area'

/** Agrega -2, -3... si el slug ya existe. `exists` consulta la tabla correspondiente */
async function uniqueSlug(base: string, exists: (slug: string) => Promise<unknown>) {
  let slug = base
  for (let i = 2; await exists(slug); i++) slug = `${base}-${i}`
  return slug
}

type Countable = { findAll: (options: object) => Promise<unknown> }

const countBy = async (model: Countable, where: Record<string, any> = {}) => {
  const rows = (await model.findAll({
    where,
    attributes: ['areaId', [fn('COUNT', col('id')), 'total']],
    group: ['areaId'],
    raw: true,
  })) as unknown as { areaId: number | null; total: string }[]
  return new Map(rows.map((r) => [r.areaId, Number(r.total)]))
}

export class AreaController {
  /** Público: áreas activas (nombre y tipo) para mostrar y filtrar */
  static async listPublic(_req: Request, res: Response) {
    res.json(await Area.findAll({ where: { active: true }, attributes: ['id', 'name', 'slug', 'type'], order: [['name', 'ASC']] }))
  }

  /** Admin: todas las áreas con su personal, categorías y reportes abiertos */
  static async list(_req: Request, res: Response) {
    const [areas, members, categories, open] = await Promise.all([
      Area.findAll({ order: [['active', 'DESC'], ['name', 'ASC']] }),
      countBy(User, { role: 'operativo' }),
      countBy(Category),
      countBy(Report, { status: OPEN_STATUSES }),
    ])
    res.json(
      areas.map((a) => ({
        ...a.toJSON(),
        membersCount: members.get(a.id) ?? 0,
        categoriesCount: categories.get(a.id) ?? 0,
        openReports: open.get(a.id) ?? 0,
      })),
    )
  }

  static async create(req: Request, res: Response) {
    const area = await Area.create({
      name: req.body.name,
      slug: await uniqueSlug(slugify(req.body.name), (slug) => Area.findOne({ where: { slug } })),
      type: req.body.type ?? 'municipal',
      description: req.body.description || null,
      contactEmail: req.body.contactEmail || null,
    })
    res.status(201).json(area)
  }

  /** Editar o desactivar (no se borran: los reportes conservan su historial) */
  static async update(req: Request, res: Response) {
    const area = await Area.findByPk(req.params.areaId)
    if (!area) {
      res.status(404).json({ error: 'Área no encontrada' })
      return
    }
    const data: Record<string, unknown> = {}
    for (const key of ['name', 'type', 'description', 'contactEmail', 'active'] as const) {
      if (req.body[key] !== undefined) data[key] = req.body[key] === '' ? null : req.body[key]
    }
    await area.update(data)
    res.json(area)
  }

  // ---------- Categorías ----------
  static async listCategories(_req: Request, res: Response) {
    res.json(await Category.findAll({ include: [{ model: Area, attributes: ['id', 'name', 'type', 'active'] }], order: [['id', 'ASC']] }))
  }

  static async createCategory(req: Request, res: Response) {
    if (req.body.areaId && !(await Area.findByPk(req.body.areaId))) {
      res.status(400).json({ error: 'Área no válida' })
      return
    }
    const category = await Category.create({
      name: req.body.name,
      slug: await uniqueSlug(slugify(req.body.name), (slug) => Category.findOne({ where: { slug } })),
      color: req.body.color ?? '#64748b',
      description: req.body.description || null,
      areaId: req.body.areaId || null,
    })
    res.status(201).json(category)
  }

  /** Cambiar el área responsable (y datos visibles) de una categoría */
  static async updateCategory(req: Request, res: Response) {
    const category = await Category.findByPk(req.params.categoryId)
    if (!category) {
      res.status(404).json({ error: 'Categoría no encontrada' })
      return
    }
    if (req.body.areaId && !(await Area.findByPk(req.body.areaId))) {
      res.status(400).json({ error: 'Área no válida' })
      return
    }
    const data: Record<string, unknown> = {}
    for (const key of ['name', 'color', 'description'] as const) {
      if (req.body[key] !== undefined) data[key] = req.body[key] || null
    }
    if (req.body.areaId !== undefined) data.areaId = req.body.areaId || null
    await category.update(data)
    res.json(category)
  }
}
