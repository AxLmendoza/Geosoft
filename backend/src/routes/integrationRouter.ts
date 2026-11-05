import { Router, type Request, type Response, type NextFunction } from 'express'
import { query } from 'express-validator'
import { timingSafeEqual } from 'node:crypto'
import { findStaleReports, staleDays } from '../controllers/AttentionController'
import { handleInputErrors } from '../middleware/validation'
import { ah } from '../utils/asyncHandler'

/**
 * Endpoints para automatizaciones externas (n8n). Deshabilitados si no hay INTEGRATION_API_KEY.
 * Autenticación: cabecera `X-API-Key: <INTEGRATION_API_KEY>`.
 */
const router = Router()

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.INTEGRATION_API_KEY
  if (!expected) {
    res.status(404).json({ error: 'Integraciones deshabilitadas' })
    return
  }
  const given = Buffer.from(String(req.headers['x-api-key'] ?? ''))
  const ok = given.length === Buffer.byteLength(expected) && timingSafeEqual(given, Buffer.from(expected))
  if (!ok) {
    res.status(401).json({ error: 'API key no válida' })
    return
  }
  next()
}

router.use(requireApiKey)

/** Reportes abiertos sin movimiento en N días → n8n manda recordatorios al área */
router.get(
  '/stale-reports',
  query('days').optional().isInt({ min: 1, max: 365 }),
  handleInputErrors,
  ah(async (req, res) => {
    res.json(await findStaleReports(staleDays(req.query.days)))
  }),
)

export default router
