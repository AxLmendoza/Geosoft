import type { Request, Response } from 'express'
import { Category } from '../models/Category'

export class CategoryController {
  static async getAll(_req: Request, res: Response) {
    res.json(await Category.findAll({ order: [['id', 'ASC']] }))
  }
}
