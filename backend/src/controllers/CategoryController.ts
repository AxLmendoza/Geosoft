import type { Request, Response } from 'express'
import { Category } from '../models/Category'
import { Area } from '../models/Area'

export class CategoryController {
  /** Incluye el área responsable para mostrar al ciudadano quién atenderá su reporte */
  static async getAll(_req: Request, res: Response) {
    res.json(
      await Category.findAll({
        include: [{ model: Area, attributes: ['id', 'name', 'type'], where: { active: true }, required: false }],
        order: [['id', 'ASC']],
      }),
    )
  }
}
