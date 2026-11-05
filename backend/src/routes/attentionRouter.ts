import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { AttentionController } from '../controllers/AttentionController'
import { authenticate, requireRole } from '../middleware/auth'
import { handleInputErrors } from '../middleware/validation'
import { uploadImage } from '../middleware/upload'
import { REPORT_STATUS, SEVERITY } from '../models/constants'
import { ah } from '../utils/asyncHandler'

const router = Router()

// Personal que atiende reportes. El alcance por área se valida en el controlador.
router.use(authenticate, requireRole('admin', 'moderador', 'operativo'))

const reportId = param('reportId').isInt().withMessage('ID no válido')
const noteRule = body('note').optional().trim().isLength({ max: 600 }).withMessage('La observación admite máximo 600 caracteres')
const internalRule = body('internal').optional().isBoolean().toBoolean()

router.get(
  '/reports',
  query('status').optional().isIn([...REPORT_STATUS]),
  query('severity').optional().isIn([...SEVERITY]),
  query('category').optional().isInt(),
  query('area').optional().custom((v) => v === 'none' || Number.isInteger(Number(v))),
  query('q').optional().trim().isLength({ max: 100 }),
  query('open').optional().isIn(['true', 'false']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleInputErrors,
  ah(AttentionController.list),
)
router.get('/summary', ah(AttentionController.summary))
router.get('/stale', query('days').optional().isInt({ min: 1, max: 365 }), handleInputErrors, ah(AttentionController.stale))

// multer primero para que req.body exista (multipart/form-data con evidencia opcional)
router.patch(
  '/reports/:reportId/status',
  uploadImage,
  reportId,
  body('status').isIn([...REPORT_STATUS]).withMessage('Estado no válido'),
  noteRule,
  internalRule,
  handleInputErrors,
  ah(AttentionController.updateStatus),
)
router.post('/reports/:reportId/updates', uploadImage, reportId, noteRule, internalRule, handleInputErrors, ah(AttentionController.addUpdate))
router.patch(
  '/reports/:reportId/assign',
  reportId,
  body('areaId').custom((v) => v === null || Number.isInteger(Number(v))).withMessage('Área no válida'),
  noteRule,
  handleInputErrors,
  ah(AttentionController.assign),
)

export default router
