import { defineConfig, type Plugin, type ServerOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'

/**
 * Modo "lan" (npm run dev:lan): para probar desde el celular en la misma red Wi-Fi.
 * - Escucha en todas las interfaces (no solo localhost).
 * - HTTPS con el certificado de .certs/ (lo genera scripts/lan-cert.sh): iOS exige contexto
 *   seguro para la ubicación, la cámara web y el service worker.
 * - Proxy de /api y /uploads hacia la API local: el teléfono solo habla con este servidor,
 *   así no depende de CORS ni de la IP de la API (.env.lan deja VITE_API_URL vacía).
 * `npm run dev`, el build y producción no cambian.
 */
const CERT_DIR = fileURLToPath(new URL('./.certs/', import.meta.url))
const API_TARGET = process.env.LAN_API_TARGET ?? 'http://localhost:4000'

function lanServer(): ServerOptions {
  const key = `${CERT_DIR}server.key`
  const cert = `${CERT_DIR}server.crt`
  if (!fs.existsSync(key) || !fs.existsSync(cert)) {
    throw new Error('Faltan los certificados de .certs/. Genéralos con: bash scripts/lan-cert.sh')
  }
  return {
    host: true,
    port: 5173,
    strictPort: true,
    https: { key: fs.readFileSync(key), cert: fs.readFileSync(cert) },
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  }
}

/** Sirve el certificado de la CA local en /dev-ca.crt para instalarlo en el iPhone (solo modo lan) */
function serveDevCA(): Plugin {
  return {
    name: 'geoscript-dev-ca',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/dev-ca.crt', (_req, res) => {
        res.setHeader('Content-Type', 'application/x-x509-ca-cert')
        res.setHeader('Content-Disposition', 'attachment; filename="geoscript-dev-ca.crt"')
        res.end(fs.readFileSync(`${CERT_DIR}ca.crt`))
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  server: mode === 'lan' ? lanServer() : undefined,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    mode === 'lan' && serveDevCA(),
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': cuando hay versión nueva se le pregunta al usuario (ver ReloadPrompt.tsx)
      registerType: 'prompt',
      // El registro lo hacemos nosotros con useRegisterSW
      injectRegister: false,
      // Activa el service worker también en `npm run dev` para probar la instalación
      devOptions: { enabled: true, type: 'module', navigateFallback: 'index.html' },
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'GeoScript - Reportes ciudadanos',
        short_name: 'GeoScript',
        description: 'Reporta fallas de servicios públicos con foto y ubicación',
        lang: 'es-MX',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['utilities', 'government', 'navigation'],
        theme_color: '#2556eb',
        background_color: '#f3f5f8',
        // 👉 Reemplaza estos archivos en /public/icons con tus íconos (mismos nombres y tamaños)
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          // Accesos directos al mantener presionado el ícono de la app (Android / escritorio)
          {
            name: 'Nuevo reporte',
            short_name: 'Reportar',
            description: 'Toma una foto y reporta un problema',
            url: '/reports/new?source=shortcut',
            icons: [{ src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Mis reportes',
            short_name: 'Mis reportes',
            description: 'Consulta el seguimiento de tus reportes',
            url: '/reports/mine?source=shortcut',
            icons: [{ src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Mapa de reportes',
            short_name: 'Mapa',
            url: '/?source=shortcut',
            icons: [{ src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        // mapbox-gl pesa ~2 MB; sin esto Workbox lo deja fuera del precache
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        runtimeCaching: [
          {
            // Fotos de los siniestros servidas por la API
            urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'report-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              // Solo datos públicos: la bandeja y el panel siempre van a la red
              request.method === 'GET' && /^\/api\/(reports|categories|areas)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
}))
