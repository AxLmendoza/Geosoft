import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { AdminController } from '../controllers/AdminController'
import { AdminReportController } from '../controllers/AdminReportController'
import { authenticate, requireRole } from '../middleware/auth'
import { handleInputErrors } from '../middleware/validation'
import { uploadImage } from '../middleware/upload'
import { REPORT_STATUS, SEVERITY } from '../models/constants'
import { ah } from '../utils/asyncHandler'

const router = Router()

// Solo el superusuario
router.use(authenticate, requireRole('admin'))

const rangeRules = [
  query('from').optional().isISO8601().withMessage('Fecha inicial no válida'),
  query('to').optional().isISO8601().withMessage('Fecha final no válida'),
]

router.patch(
  '/users/:userId/role',
  param('userId').isInt(),
  body('role').isIn(['ciudadano', 'moderador']).withMessage('Rol no válido'),
  handleInputErrors,
  ah(AdminController.setRole),
)

router.get('/stats', ...rangeRules, handleInputErrors, ah(AdminController.stats))
router.get('/stats/pdf', ...rangeRules, handleInputErrors, ah(AdminController.statsPdf))
router.patch('/reports/:reportId/restore', param('reportId').isInt(), handleInputErrors, ah(AdminController.restoreReport))

// ---------- CRUD de reportes ----------
const reportId = param('reportId').isInt().withMessage('ID no válido')

/** En la edición todos los campos son opcionales; al crear, los básicos son obligatorios */
const reportRules = (required: boolean) => {
  const f = (name: string) => (required ? body(name) : body(name).optional())
  return [
    f('title').trim().isLength({ min: 3, max: 120 }).withMessage('El título debe tener entre 3 y 120 caracteres'),
    f('description').trim().isLength({ min: 10, max: 2000 }).withMessage('Describe el problema (mínimo 10 caracteres)'),
    f('categoryId').isInt().withMessage('Selecciona una categoría').toInt(),
    f('lat').isFloat({ min: -90, max: 90 }).withMessage('Latitud no válida').toFloat(),
    f('lng').isFloat({ min: -180, max: 180 }).withMessage('Longitud no válida').toFloat(),
    body('severity').optional().isIn([...SEVERITY]).withMessage('Gravedad no válida'),
    body('status').optional().isIn([...REPORT_STATUS]).withMessage('Estado no válido'),
    body('colonia').optional().trim().isLength({ max: 120 }),
    body('calle').optional().trim().isLength({ max: 160 }),
    body('anonymous').optional().isBoolean().toBoolean(),
    body('hidden').optional().isBoolean().toBoolean(),
    body('hiddenReason').optional().trim().isLength({ max: 300 }),
    body('note').optional().trim().isLength({ max: 300 }),
  ]
}

router.get(
  '/reports',
  query('q').optional().trim().isLength({ max: 100 }),
  query('category').optional().isInt(),
  query('status').optional().isIn([...REPORT_STATUS]),
  query('severity').optional().isIn([...SEVERITY]),
  query('deleted').optional().isIn(['true', 'all']),
  handleInputErrors,
  ah(AdminReportController.list),
)
// multer primero para que req.body exista (multipart/form-data)
router.post('/reports', uploadImage, ...reportRules(true), handleInputErrors, ah(AdminReportController.create))
router.put('/reports/:reportId', uploadImage, reportId, ...reportRules(false), handleInputErrors, ah(AdminReportController.update))
router.delete('/reports/:reportId', reportId, handleInputErrors, ah(AdminReportController.destroy))

export default router
