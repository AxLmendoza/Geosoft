/**
 * Arranca la API contra la BD local de pruebas (TEST_DATABASE_URL) sin tocar DATABASE_URL.
 *   npm run dev:test
 * Se niega a arrancar si TEST_DATABASE_URL no está definida o apunta a Render.
 */
import { useTestDatabase } from './useTestDatabase'

if (!useTestDatabase()) {
  console.error('✖ Define TEST_DATABASE_URL en backend/.env (BD local de pruebas) para usar dev:test.')
  process.exit(1)
}
const host = new URL(process.env.DATABASE_URL!).hostname
if (host.endsWith('render.com') || host.startsWith('dpg-')) {
  console.error('✖ TEST_DATABASE_URL no puede apuntar a Render.')
  process.exit(1)
}
console.log(`• Modo pruebas: BD ${host}`)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('../index')
