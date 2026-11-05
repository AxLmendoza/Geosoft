import 'reflect-metadata'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import authRouter from './routes/authRouter'
import reportRouter from './routes/reportRouter'
import categoryRouter, { areaRouter } from './routes/categoryRouter'
import attentionRouter from './routes/attentionRouter'
import integrationRouter from './routes/integrationRouter'
import moderationRouter from './routes/moderationRouter'
import adminRouter from './routes/adminRouter'
import { apiLimiter } from './middleware/limiter'
import { errorHandler, notFound } from './middleware/errors'
import { UPLOAD_ROOT } from './utils/storage'

const app = express()

// Render (y casi cualquier hosting) pone un proxy delante: necesario para el rate limiter
app.set('trust proxy', 1)

const origins = (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',').map((o) => o.trim())
app.use(cors({ origin: origins, exposedHeaders: ['X-Total-Count'] }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '1mb' }))

// Imágenes subidas por los usuarios (almacenamiento local)
app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '30d', immutable: true }))

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api', apiLimiter)
app.use('/api/auth', authRouter)
app.use('/api/categories', categoryRouter)
app.use('/api/reports', reportRouter)
app.use('/api/moderation', moderationRouter)
app.use('/api/admin', adminRouter)
app.use('/api/areas', areaRouter)
app.use('/api/attention', attentionRouter)
app.use('/api/integrations', integrationRouter)

app.use(notFound)
app.use(errorHandler)

export default app
