import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { ModerationController } from '../controllers/ModerationController'
import { authenticate, requireRole } from '../middleware/auth'
import { handleInputErrors } from '../middleware/validation'
import { FLAG_STATUS, REPORT_STATUS } from '../models/constants'
import { ah } from '../utils/asyncHandler'

const router = Router()

// Todo este router es para moderadores y el admin
router.use(authenticate, requireRole('moderador', 'admin'))

const reportId = param('reportId').isInt().withMessage('ID no válido')
const userId = param('userId').isInt().withMessage('ID no válido')

// Denuncias
router.get('/flags', query('status').optional().isIn([...FLAG_STATUS]), handleInputErrors, ah(ModerationController.getFlags))
router.patch(
  '/flags/:flagId',
  param('flagId').isInt(),
  body('status').isIn(['procedente', 'descartada']).withMessage('Resolución no válida'),
  body('hideReport').optional().isBoolean().toBoolean(),
  handleInputErrors,
  ah(ModerationController.reviewFlag),
)

// Reportes
router.get('/reports', ah(ModerationController.getReports))
router.patch(
  '/reports/:reportId/status',
  reportId,
  body('status').isIn([...REPORT_STATUS]).withMessage('Estado no válido'),
  body('note').optional().trim().isLength({ max: 300 }),
  handleInputErrors,
  ah(ModerationController.updateStatus),
)
router.patch(
  '/reports/:reportId/visibility',
  reportId,
  body('hidden').isBoolean().toBoolean(),
  body('reason').optional().trim().isLength({ max: 300 }),
  handleInputErrors,
  ah(ModerationController.setVisibility),
)
router.delete('/reports/:reportId', reportId, handleInputErrors, ah(ModerationController.deleteReport))

// Usuarios
router.get('/users', ah(ModerationController.getUsers))
router.post(
  '/users/:userId/ban',
  userId,
  body('reason').trim().isLength({ min: 5, max: 300 }).withMessage('Indica el motivo del baneo (mín. 5 caracteres)'),
  body('hideReports').optional().isBoolean().toBoolean(),
  handleInputErrors,
  ah(ModerationController.banUser),
)
router.delete('/users/:userId/ban', userId, handleInputErrors, ah(ModerationController.unbanUser))

// Lista negra
router.get('/blacklist', ah(ModerationController.getBlacklist))
router.post(
  '/blacklist',
  body('email').isEmail().withMessage('Correo no válido').normalizeEmail({ gmail_remove_dots: false }),
  body('reason').trim().isLength({ min: 5, max: 300 }).withMessage('Indica el motivo (mín. 5 caracteres)'),
  handleInputErrors,
  ah(ModerationController.addToBlacklist),
)
router.delete('/blacklist/:id', param('id').isInt(), handleInputErrors, ah(ModerationController.removeFromBlacklist))

export default router
