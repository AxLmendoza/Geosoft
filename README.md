# GeoScript · Reportes ciudadanos geolocalizados

Plataforma (API + PWA) para reportar fallas de servicios públicos con **foto**, **ubicación** y **categoría**. En el mapa, cada pin muestra la foto del siniestro.

```
geoscript/
├── backend/          Express + TypeScript + Sequelize (PostgreSQL en Render)
│   ├── uploads/      ← aquí se guardan las imágenes (almacenamiento local)
│   └── src/
│       ├── config/       db.ts, mailer.ts
│       ├── controllers/  Auth, Report, Category, Moderation, Admin
│       ├── middleware/   auth (JWT + roles), validation, limiter, upload (multer), errors
│       ├── models/       User, Category, Report, ReportFlag, ReportHistory, Blacklist
│       ├── routes/       authRouter, reportRouter, categoryRouter, moderationRouter, adminRouter
│       ├── emails/       AuthEmail (nodemailer + Mailtrap)
│       └── utils/        auth, storage (Adapter), serializers, seed, asyncHandler
└── frontend/         React + Vite + Tailwind v4 + HeadlessUI + Heroicons + PWA
```

---

## 1. Backend

```bash
cd backend
npm install
cp .env.example .env     # pon tu DATABASE_URL de Render, Mailtrap y el admin
npm run dev              # http://localhost:4000
```

Al arrancar:
- `sequelize.sync({ alter: true })` crea/ajusta las tablas (en `NODE_ENV=production` no se altera).
- Se insertan las **10 categorías** y se crea el **superusuario** con `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Producción: `npm run build && npm start`.

### Scripts de base de datos

| Comando | Qué hace |
|---|---|
| `npm run db:seed` | Crea tablas faltantes, las 10 categorías y el superusuario |
| `npm run db:clear` | **Vacía** reportes, votos, denuncias, historial, lista negra, usuarios (menos el admin) y las imágenes. Conserva categorías y admin |
| `npm run db:reset` | **Borra todas las tablas y ENUMs**, las crea de nuevo y siembra |
| `npm run db:demo` | Crea 8 usuarios (`demo1..8@geoscript.local` / `Demo12345`, demo1 es moderador) y 60 reportes con fotos de prueba, votos y algunos eliminados. `npm run db:demo -- 150` para otra cantidad |
| `npm run db:purge-uploads` | Borra imágenes huérfanas que ya no pertenecen a ningún reporte |

Piden escribir `si` para confirmar. Para saltar la confirmación: `npm run db:clear -- --yes`. Con `NODE_ENV=production` se bloquean salvo que agregues `--force`.

### Variables de entorno

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | URL **externa** de Postgres en Render |
| `DATABASE_SSL` | `true` para Render (por defecto) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Sesión |
| `TOKEN_TTL_MINUTES` | Minutos que dura el código de 6 dígitos (15 por defecto) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Superusuario |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Mailtrap (sandbox) |
| `FRONTEND_URL` | CORS y enlaces de los correos (puedes poner varios separados por coma) |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Carpeta y tamaño máximo de imágenes |
| `FLAG_AUTOHIDE` | Denuncias pendientes para ocultar un reporte automáticamente (5) |
| `RESOLVED_VISIBLE_DAYS` | Días que un reporte resuelto sigue en el mapa antes de retirarse (2) |
| `APP_TIMEZONE` | Zona horaria para estadísticas y PDF (`America/Mexico_City`) |

Las dos últimas son opcionales: si no están en tu `.env` se usan esos valores.

### Imágenes (almacenamiento local)
- `multer` las recibe en memoria → `sharp` las corrige de orientación, **borra metadatos EXIF (incluido el GPS de la foto)** y genera:
  - `uploads/reports/<uuid>.webp` (máx. 1600 px)
  - `uploads/reports/<uuid>_thumb.webp` (160×160, la que se ve dentro del pin)
- Se sirven en `GET /uploads/...`.
- Está detrás de un **Storage Adapter** (`utils/storage.ts`, patrón Adapter del documento), así que cambiar a otro almacenamiento después solo toca ese archivo.

> ⚠️ **Render:** el disco de un Web Service es efímero; cada deploy o reinicio **borra `uploads/`**. Agrega un **Persistent Disk** (plan de pago) montado en, por ejemplo, `/var/data/uploads` y pon `UPLOAD_DIR=/var/data/uploads`.

### Confirmación de cuenta
1. Registro → se genera un código de 6 dígitos con expiración (`tokenExpiresAt`) y se envía por correo.
2. Una cuenta **sin confirmar no puede iniciar sesión** (403 `UNCONFIRMED`). Si intenta entrar con el código vencido, se le envía otro automáticamente.
3. `authenticate` vuelve a revisar `confirmed` y `banned` en cada petición.

### Roles
| Rol | Puede |
|---|---|
| `ciudadano` | Crear reportes (anónimos o no), borrar los suyos, denunciar reportes de otros |
| `moderador` | Todo lo anterior + revisar denuncias, cambiar estado, ocultar/borrar reportes, **banear ciudadanos**, gestionar lista negra |
| `admin` (superusuario) | Todo lo anterior + **nombrar/quitar moderadores** y banear moderadores |

**Anonimato:** si un reporte es anónimo, la API **no envía** el autor a nadie excepto al propio autor, a moderadores y al admin (`utils/serializers.ts`).

**Baneo:** marca al usuario como `banned`, agrega su correo a la **lista negra** (no puede volver a registrarse) y opcionalmente oculta todos sus reportes. Desbanear lo revierte.

### Seguimiento y cierre de reportes
- **Comunidad (“clap”)**: cualquier usuario puede votar **👏 Ya quedó** o **Sigue igual** (un voto por persona; votar lo mismo otra vez lo quita). Es informativo.
- **Autor**: puede marcar **“Me dieron seguimiento”** (`en_proceso`) o **“Ya quedó solucionado”** (`resuelto`).
- **Moderador / admin**: cambian a cualquier estado. En Moderación → Reportes hay un filtro **“La comunidad dice que ya quedó”** con botón directo **Solucionado**.
- Al pasar a `resuelto` se guarda `resolvedAt` y el reporte **se retira solo del mapa público a los 2 días**. No se borra: sigue en “Mis reportes”, en el detalle, en moderación y en las estadísticas.
- Todo cambio queda en el historial de seguimiento (quién, cuándo y nota).

### Borrado lógico
`Report` usa `paranoid: true`: borrar solo llena `deletedAt` y `deletedById`, y la imagen se conserva. El reporte desaparece de la app, pero el admin lo sigue viendo (filtro **Eliminados**), puede **restaurarlo** y cuenta en las estadísticas y el PDF.

### Estadísticas y PDF (admin)
`/admin/stats` en la app muestra:
- Indicadores: total, resueltos, abiertos, tasa de resolución, tiempo promedio de solución, votos, usuarios, baneados y denuncias.
- Gráficas: reportados vs. resueltos por mes, por categoría (abiertos/resueltos/rechazados), por estado y por gravedad.
- Tabla de **zonas prioritarias**: índice por colonia según la gravedad de los reportes abiertos.

**Descargar PDF** genera en el servidor (`pdf-lib`, sin dependencias nativas) un informe con portada, indicadores, las mismas gráficas, las zonas prioritarias y el detalle de todos los reportes del periodo, incluidos los eliminados.

### Rate limiting
- `/api/*`: 300 peticiones / 15 min por IP
- `/api/auth/*`: 20 / 15 min
- Crear reportes: 15 / hora por usuario

### Endpoints

**Auth** `/api/auth`
| Método | Ruta | Body |
|---|---|---|
| POST | `/create-account` | `name, email, password, password_confirmation` |
| POST | `/confirm-account` | `token` |
| POST | `/request-code` | `email` |
| POST | `/login` | `email, password` → `{ token }` |
| POST | `/forgot-password` | `email` |
| POST | `/validate-token` | `token` |
| POST | `/reset-password/:token` | `password, password_confirmation` |
| GET | `/user` | (Bearer) |

**Reportes** `/api/reports`
| Método | Ruta | Notas |
|---|---|---|
| GET | `/` | Público. Filtros: `category, status, severity, from, bbox=minLng,minLat,maxLng,maxLat` |
| GET | `/mine` | Mis reportes |
| GET | `/:reportId` | Detalle + historial de seguimiento |
| POST | `/` | `multipart/form-data`: `image, title, description, categoryId, severity, lat, lng, colonia?, calle?, anonymous` |
| PATCH | `/:reportId/status` | Autor: `status (en_proceso · resuelto), note?` |
| POST | `/:reportId/vote` | `value (solucionado · sin_solucion)` |
| DELETE | `/:reportId` | Autor (borrado lógico) |
| POST | `/:reportId/flags` | `reason (informacion_falsa · imagen_inapropiada · spam_basura · duplicado · otro), comment?` |

**Categorías** `GET /api/categories`

**Moderación** `/api/moderation` (moderador / admin)
`GET /flags?status=` · `PATCH /flags/:id {status: procedente|descartada, hideReport}` · `GET /reports?status=&hidden=` · `PATCH /reports/:id/status {status, note}` · `PATCH /reports/:id/visibility {hidden, reason}` · `DELETE /reports/:id` · `GET /users?q=&role=&banned=` · `POST /users/:id/ban {reason, hideReports}` · `DELETE /users/:id/ban` · `GET|POST /blacklist` · `DELETE /blacklist/:id`

**Admin** `/api/admin` (solo admin)
`PATCH /users/:id/role {role: moderador|ciudadano}` · `GET /stats?from=&to=` · `GET /stats/pdf?from=&to=` · `PATCH /reports/:id/restore`

En moderación, `GET /reports` acepta además `deleted=true` y `community=solucionado`.

Estados del reporte: `pendiente → en_revision → en_proceso → resuelto | rechazado`. Cada cambio queda en `report_history`.

---

## 2. Frontend (PWA)

```bash
cd frontend
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:4000
npm run dev              # http://localhost:5173
```

- **Mapa** (react-leaflet + OpenStreetMap): pin circular con la **miniatura de la foto**, borde del color de la categoría; los críticos laten y los resueltos se ven en gris. Popup con la foto grande, estado, gravedad y fecha.
- **Cámara / Dropzone**:
  - Celular / tablet (pantalla táctil): botón **Tomar foto** (`capture="environment"`, abre la cámara nativa) y **Galería**. Botón de cámara flotante en la barra inferior.
  - PC / laptop: **dropzone** (`react-dropzone`) + **Usar cámara web** (`getUserMedia`, en un Dialog de HeadlessUI).
- **Ubicación**: GPS del dispositivo o clic en el mapa / arrastrar el pin; sugiere colonia y calle con Nominatim.
- **Confirmación**: 6 cuadros con `PinInput` de Chakra UI.
- **Fechas**: `date-fns` en español (`lib/date.ts`): “hace 3 horas”, “15 de octubre de 2026, 01:18”, “Ayer, 09:10”.
- **HeadlessUI**: Dialog, Listbox, Menu, Tabs, RadioGroup, Switch, Checkbox.
- **Panel de moderación** (`/moderation`): Denuncias · Reportes · Usuarios (y moderadores para el admin) · Lista negra.

### PWA instalable
- **Manifest** y **service worker** los genera `vite-plugin-pwa` desde `vite.config.ts`: nombre, íconos, `display: standalone`, colores, atajo “Nuevo reporte” y Workbox con caché de mapas, fotos y API.
- Están activos también en `npm run dev` (`devOptions.enabled`), así que puedes probar la instalación sin hacer build.
- **Instalar app**: en Android/Chrome/Edge aparece un banner con botón **Instalar** (`beforeinstallprompt`). En iPhone/iPad se muestran las instrucciones (Compartir → Agregar a inicio).
- **Actualizaciones**: cuando despliegas una versión nueva aparece “Nueva versión disponible → Actualizar ahora”.
- **Sin conexión**: banner amarillo; el mapa, los reportes ya vistos y las fotos se sirven desde caché.
- Para que Chrome ofrezca instalar se necesita **HTTPS** (o localhost) y los íconos 192 y 512.

### Íconos de la PWA
Reemplaza los archivos de `frontend/public/icons/` con los tuyos **con el mismo nombre y tamaño**:
`pwa-192x192.png`, `pwa-512x512.png`, `maskable-512x512.png` (con margen de seguridad), `apple-touch-icon.png` (180×180) y `public/favicon.svg`.

### Notas
- La cámara web y la geolocalización **solo funcionan en HTTPS** (o `localhost`). Para probar desde el celular en tu red usa un túnel HTTPS (ngrok, cloudflared) o despliega.
- Si el `PinInput` de Chakra se ve sin estilos o falla en tu versión, envuelve `<TokenInput>` con `ChakraProvider` (`@chakra-ui/react` v2 con `resetCSS={false}`).
