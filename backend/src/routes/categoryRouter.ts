import { Router } from 'express'
import { CategoryController } from '../controllers/CategoryController'
import { AreaController } from '../controllers/AreaController'
import { ah } from '../utils/asyncHandler'

const router = Router()
router.get('/', ah(CategoryController.getAll))
export default router

/** Áreas activas (público: solo nombre y tipo) */
export const areaRouter = Router()
areaRouter.get('/', ah(AreaController.listPublic))
