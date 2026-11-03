import { Router } from 'express'
import { CategoryController } from '../controllers/CategoryController'
import { ah } from '../utils/asyncHandler'

const router = Router()
router.get('/', ah(CategoryController.getAll))
export default router
