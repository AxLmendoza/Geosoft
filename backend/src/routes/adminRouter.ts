import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { AdminController } from '../controllers/AdminController'
import { AdminReportController } from '../controllers/AdminReportController'
import { AreaController } from '../controllers/AreaController'
import { authenticate, requireRole } from '../middleware/auth'
import { handleInputErrors } from '../middleware/validation'
import { uploadImage } from '../middleware/upload'
import { AREA_TYPES, REPORT_STATUS, SEVERITY } from '../models/constants'
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
  body('role').isIn(['ciudadano', 'moderador', 'operativo']).withMessage('Rol no válido'),
  body('areaId').if(body('role').equals('operativo')).isInt().withMessage('Selecciona el área del personal operativo').toInt(),
  handleInputErrors,
  ah(AdminController.setRole),
)

// ---------- Áreas y categorías (configurables sin tocar código) ----------
const areaRules = (required: boolean) => [
  (required ? body('name') : body('name').optional()).trim().isLength({ min: 3, max: 120 }).withMessage('El nombre debe tener entre 3 y 120 caracteres'),
  body('type').optional().isIn([...AREA_TYPES]).withMessage('Tipo de área no válido'),
  body('description').optional({ values: 'null' }).trim().isLength({ max: 300 }),
  body('contactEmail').optional({ values: 'falsy' }).isEmail().withMessage('Correo de contacto no válido').normalizeEmail({ gmail_remove_dots: false }),
  body('active').optional().isBoolean().toBoolean(),
]
router.get('/areas', ah(AreaController.list))
router.post('/areas', ...areaRules(true), handleInputErrors, ah(AreaController.create))
router.put('/areas/:areaId', param('areaId').isInt(), ...areaRules(false), handleInputErrors, ah(AreaController.update))

const categoryRules = (required: boolean) => [
  (required ? body('name') : body('name').optional()).trim().isLength({ min: 3, max: 60 }).withMessage('El nombre debe tener entre 3 y 60 caracteres'),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Color no válido (usa #RRGGBB)'),
  body('description').optional({ values: 'null' }).trim().isLength({ max: 200 }),
  body('areaId').optional({ values: 'null' }).isInt().withMessage('Área no válida').toInt(),
]
router.get('/categories', ah(AreaController.listCategories))
router.post('/categories', ...categoryRules(true), handleInputErrors, ah(AreaController.createCategory))
router.put('/categories/:categoryId', param('categoryId').isInt(), ...categoryRules(false), handleInputErrors, ah(AreaController.updateCategory))

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
  query('area').optional().custom((v) => v === 'none' || Number.isInteger(Number(v))),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  handleInputErrors,
  ah(AdminReportController.list),
)
// multer primero para que req.body exista (multipart/form-data)
router.post('/reports', uploadImage, ...reportRules(true), handleInputErrors, ah(AdminReportController.create))
router.put('/reports/:reportId', uploadImage, reportId, ...reportRules(false), handleInputErrors, ah(AdminReportController.update))
router.delete('/reports/:reportId', reportId, handleInputErrors, ah(AdminReportController.destroy))

export default router
