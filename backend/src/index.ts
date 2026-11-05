import dotenv from 'dotenv'
dotenv.config()
// Fechas del servidor (PDF, estadísticas por mes) en horario de México
process.env.TZ = process.env.APP_TIMEZONE ?? 'America/Mexico_City'

import app from './server'
import { connectDB } from './config/db'
import { seed } from './utils/seed'
import { checkMailer } from './config/mailer'

const port = Number(process.env.PORT ?? 4000)

async function main() {
  await connectDB()
  await seed()
  app.listen(port, () => console.log(`✔ API de GeoScript en http://localhost:${port}`))
  void checkMailer()
}

main().catch((err) => {
  console.error('✖ No se pudo iniciar el servidor:', err)
  process.exit(1)
})
