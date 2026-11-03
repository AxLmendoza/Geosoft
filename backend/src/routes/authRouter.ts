import { Router } from 'express'
import { body, param } from 'express-validator'
import { AuthController } from '../controllers/AuthController'
import { handleInputErrors } from '../middleware/validation'
import { authenticate } from '../middleware/auth'
import { authLimiter } from '../middleware/limiter'
import { ah } from '../utils/asyncHandler'

const router = Router()

const tokenRule = (field: ReturnType<typeof body>) =>
  field.isLength({ min: 6, max: 6 }).withMessage('El código debe tener 6 dígitos').isNumeric().withMessage('Código no válido')

const passwordRules = [
  body('password').isLength({ min: 8 }).withMessage('El password debe tener al menos 8 caracteres'),
  body('password_confirmation').custom((value, { req }) => {
    if (value !== req.body.password) throw new Error('Los passwords no coinciden')
    return true
  }),
]

router.use(authLimiter)

router.post(
  '/create-account',
  body('name').trim().notEmpty().withMessage('El nombre es obligatorio').isLength({ max: 60 }),
  body('email').isEmail().withMessage('Correo no válido').normalizeEmail({ gmail_remove_dots: false }),
  ...passwordRules,
  handleInputErrors,
  ah(AuthController.createAccount),
)

router.post('/confirm-account', tokenRule(body('token')), handleInputErrors, ah(AuthController.confirmAccount))

router.post(
  '/request-code',
  body('email').isEmail().withMessage('Correo no válido').normalizeEmail({ gmail_remove_dots: false }),
  handleInputErrors,
  ah(AuthController.requestConfirmationCode),
)

router.post(
  '/login',
  body('email').isEmail().withMessage('Correo no válido').normalizeEmail({ gmail_remove_dots: false }),
  body('password').notEmpty().withMessage('El password es obligatorio'),
  handleInputErrors,
  ah(AuthController.login),
)

router.post(
  '/forgot-password',
  body('email').isEmail().withMessage('Correo no válido').normalizeEmail({ gmail_remove_dots: false }),
  handleInputErrors,
  ah(AuthController.forgotPassword),
)

router.post('/validate-token', tokenRule(body('token')), handleInputErrors, ah(AuthController.validateToken))

router.post(
  '/reset-password/:token',
  param('token').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Código no válido'),
  ...passwordRules,
  handleInputErrors,
  ah(AuthController.resetPassword),
)

router.get('/user', authenticate, ah(AuthController.user))

export default router
