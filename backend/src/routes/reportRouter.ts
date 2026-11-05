import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { ReportController } from '../controllers/ReportController'
import { authenticate, optionalAuth } from '../middleware/auth'
import { handleInputErrors } from '../middleware/validation'
import { uploadImage } from '../middleware/upload'
import { createReportLimiter } from '../middleware/limiter'
import { FLAG_REASONS, OWNER_STATUSES, REPORT_STATUS, SEVERITY, VOTE_VALUES } from '../models/constants'
import { ah } from '../utils/asyncHandler'

const router = Router()

const reportId = param('reportId').isInt().withMessage('ID no válido')

router.get(
  '/',
  optionalAuth,
  query('category').optional().isInt(),
  query('status').optional().isIn([...REPORT_STATUS]),
  query('severity').optional().isIn([...SEVERITY]),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  handleInputErrors,
  ah(ReportController.getAll),
)

router.get('/mine', authenticate, ah(ReportController.getMine))

router.get('/:reportId', optionalAuth, reportId, handleInputErrors, ah(ReportController.getById))

router.post(
  '/',
  authenticate,
  createReportLimiter,
  uploadImage, // multer primero para que req.body exista (multipart/form-data)
  body('title').trim().isLength({ min: 3, max: 120 }).withMessage('El título debe tener entre 3 y 120 caracteres'),
  body('description').trim().isLength({ min: 10, max: 2000 }).withMessage('Describe el problema (mínimo 10 caracteres)'),
  body('categoryId').isInt().withMessage('Selecciona una categoría').toInt(),
  body('severity').optional().isIn([...SEVERITY]).withMessage('Gravedad no válida'),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Latitud no válida').toFloat(),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Longitud no válida').toFloat(),
  body('colonia').optional().trim().isLength({ max: 120 }),
  body('calle').optional().trim().isLength({ max: 160 }),
  body('anonymous').optional().isBoolean().toBoolean(),
  handleInputErrors,
  ah(ReportController.create),
)

// El autor: "ya me dieron seguimiento" / "ya quedó"
router.patch(
  '/:reportId/status',
  authenticate,
  reportId,
  body('status').isIn([...OWNER_STATUSES]).withMessage('Estado no válido'),
  body('note').optional().trim().isLength({ max: 300 }),
  handleInputErrors,
  ah(ReportController.ownerStatus),
)

// El autor agrega información adicional (texto y/o foto) a su reporte
router.post(
  '/:reportId/updates',
  authenticate,
  uploadImage,
  reportId,
  body('note').optional().trim().isLength({ max: 600 }).withMessage('Máximo 600 caracteres'),
  handleInputErrors,
  ah(ReportController.addInfo),
)

// La comunidad: 👏 ya quedó / sigue igual
router.post(
  '/:reportId/vote',
  authenticate,
  reportId,
  body('value').isIn([...VOTE_VALUES]).withMessage('Voto no válido'),
  handleInputErrors,
  ah(ReportController.vote),
)

router.delete('/:reportId', authenticate, reportId, handleInputErrors, ah(ReportController.remove))

router.post(
  '/:reportId/flags',
  authenticate,
  reportId,
  body('reason').isIn([...FLAG_REASONS]).withMessage('Motivo no válido'),
  body('comment').optional().trim().isLength({ max: 300 }),
  handleInputErrors,
  ah(ReportController.flag),
)

export default router
