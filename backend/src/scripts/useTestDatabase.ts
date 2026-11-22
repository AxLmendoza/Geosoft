import dotenv from 'dotenv'

/**
 * Cambia la conexión a TEST_DATABASE_URL (BD local de pruebas) si está definida.
 * Debe ejecutarse antes de importar config/db: dotenv no sobrescribe variables ya
 * definidas, así que DATABASE_URL de .env (Render) queda ignorada en este proceso.
 * Devuelve true si se usa la BD de pruebas.
 */
export function useTestDatabase() {
  dotenv.config()
  const url = process.env.TEST_DATABASE_URL
  if (!url) return false
  process.env.DATABASE_URL = url
  process.env.DATABASE_SSL = process.env.TEST_DATABASE_SSL ?? 'false'
  return true
}
