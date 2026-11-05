# GeoScript: diagnóstico y propuestas técnicas

Documento de apoyo a los cambios de seguimiento, distribución por área y roles. Cubre:
automatizaciones con n8n, almacenamiento en Amazon S3, rendimiento y correo.

---

## 1. Arquitectura actual (resumen)

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 6 + TypeScript, Tailwind 4, React Query 5, React Router 6, Mapbox GL, Recharts. PWA (vite-plugin-pwa / Workbox) |
| Backend | Node 18 + Express 4 + TypeScript, Sequelize 6 (sequelize-typescript), express-validator, multer, sharp, nodemailer, pdf-lib |
| Base de datos | PostgreSQL (Render) |
| Imágenes | Disco local del servidor (`backend/uploads/reports`), servidas en `/uploads` |
| Autenticación | JWT (Bearer) + códigos de 6 dígitos por correo |

### Flujo de un reporte (después de los cambios)

```
Ciudadano crea reporte ─► "Reporte recibido"
        │
        ├─ categoría con área interna ─► asignación automática ─► "Asignado a un área"
        ├─ categoría con autoridad externa ─► nota "podría corresponder a X" (queda recibido)
        └─ categoría sin área ─► queda recibido para clasificación manual
                         │
Admin (Atención Ciudadana): validar · asignar / reasignar · canalizar · no procedente · cerrar
Personal operativo (su área): "Atención en proceso" · "Resuelto" · observaciones · evidencias
Ciudadano: consulta su línea de tiempo · agrega información · confirma "ya quedó"
```

Cada movimiento queda en `report_history` con fecha y hora, responsable (`changedById`), tipo
(`estado`, `asignacion`, `nota`, `evidencia`, `ciudadano`), área de origen y destino, nota interna
o pública y foto de evidencia opcional.

---

## 2. Automatizaciones con n8n

### Compatibilidad

n8n se comunica por HTTP (nodo **Webhook** para recibir y **HTTP Request** para consultar), así que
es compatible con la API actual sin agregar dependencias al proyecto. La integración quedó
**preparada y opcional**:

- Si `N8N_WEBHOOK_URL` está vacía, no se envía nada y la plataforma funciona igual.
- Los envíos ocurren **después** de confirmar la transacción, en segundo plano, con 5 s de tiempo
  límite. Si n8n está caído, la petición del usuario no falla (probado: la API respondió 200 y solo
  dejó un aviso en consola).
- Cada envío lleva `X-GeoScript-Signature` = HMAC-SHA256 del cuerpo con `N8N_WEBHOOK_SECRET`,
  para que n8n descarte peticiones falsas.

### Eventos que emite la plataforma

| Evento (`X-GeoScript-Event`) | Cuándo | Datos útiles |
|---|---|---|
| `report.created` | Un ciudadano o el admin crea un reporte | reporte, categoría, área, ciudadano |
| `report.assigned` | Asignación automática, reasignación o canalización | `fromAreaId`, `toAreaId`, `fromStatus`, `toStatus` |
| `report.status_changed` | Cualquier cambio de estado | `fromStatus`, `toStatus`, `note` (las notas internas no se envían) |
| `report.updated` | Observación pública, evidencia o información del ciudadano | `kind`, `note` |

Cuerpo (ejemplo resumido):

```json
{
  "event": "report.status_changed",
  "fromStatus": "asignado",
  "toStatus": "en_proceso",
  "report": {
    "id": 43, "title": "Bache profundo", "status": "en_proceso", "severity": "alta",
    "url": "https://tu-frontend/reports/43",
    "category": { "id": 5, "name": "Baches y vialidad" },
    "area": { "id": 3, "name": "Obras Públicas", "type": "municipal", "contactEmail": "obras@..." }
  },
  "citizen": { "id": 12, "name": "…", "email": "…" }
}
```

### Endpoint para que n8n consulte

`GET /api/integrations/stale-reports?days=5` con cabecera `X-API-Key: <INTEGRATION_API_KEY>`.
Devuelve los reportes abiertos sin movimiento en N días, con su área y correo de contacto.
Sin `INTEGRATION_API_KEY` el endpoint responde 404 (deshabilitado).

### Flujos recomendados

1. **Aviso al ciudadano cuando cambia su reporte**
   Webhook (`report.status_changed`, `report.assigned`) → IF firma válida → Set (texto según
   `toStatus`) → Send Email / WhatsApp a `citizen.email` con el enlace `report.url`.
2. **Aviso al área cuando recibe un reporte**
   Webhook (`report.assigned` con `toAreaId`) → Send Email a `report.area.contactEmail`.
3. **Alertas de urgentes**
   Webhook (`report.created`) → IF `severity` = `critica` → Email/Telegram/Slack al área y a
   Atención Ciudadana.
4. **Recordatorios de reportes estancados**
   Schedule Trigger (diario 8:00) → HTTP Request a `/api/integrations/stale-reports` → Split por
   área → Email con la lista al `contactEmail` del área (y copia al admin si pasan del doble de días).
5. **Resumen semanal** (opcional)
   Schedule → HTTP Request a `/api/admin/stats` con un usuario de servicio → Email al admin.

### Verificación de firma en n8n (nodo Code)

```js
const crypto = require('crypto')
const body = JSON.stringify($json.body)
const firma = crypto.createHmac('sha256', $env.GEOSCRIPT_SECRET).update(body).digest('hex')
if (firma !== $json.headers['x-geoscript-signature']) throw new Error('Firma no válida')
return $input.all()
```

> Nota: n8n debe recibir el cuerpo sin modificar. Si se usa "Raw Body" en el nodo Webhook, firma
> sobre ese texto.

### Qué falta configurar

- Instancia de n8n (n8n Cloud o self-hosted con HTTPS).
- `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` e `INTEGRATION_API_KEY` en el `.env` de la API.
- Credenciales de correo/mensajería dentro de n8n.
- Correo de contacto de cada área (Administración → Áreas).

---

## 3. Imágenes: diagnóstico actual y propuesta con Amazon S3

### Cómo funciona hoy

| Paso | Implementación |
|---|---|
| Subida (frontend) | `ImageInput` (cámara nativa en celular, dropzone/cámara web en PC) → `FormData` campo `image`. **Nuevo:** las fotos de más de 1.5 MB se reducen en el navegador a 2000 px JPEG antes de subir |
| Recepción (backend) | `multer.memoryStorage()`, 1 archivo, máx. `MAX_UPLOAD_MB` (8), filtro por MIME declarado |
| Procesamiento | `sharp`: corrige orientación EXIF, elimina metadatos (incluido GPS), genera WebP. **Nuevo:** 3 variantes (1600 px, 640 px para tarjetas, 160 px miniatura) y validación real del contenido |
| Almacenamiento | Disco local: `uploads/reports/<uuid>.webp`, `<uuid>_md.webp`, `<uuid>_thumb.webp` |
| Base de datos | Rutas relativas en `reports.imageUrl`, `mediumUrl`, `thumbUrl` y, para evidencias, `report_history.imageUrl/thumbUrl` |
| Visualización | `express.static('/uploads')` con caché de 30 días; el service worker las guarda (CacheFirst, 300 entradas) |

### Problemas encontrados

1. **Crítico en Render:** el disco de un Web Service de Render es **efímero**. En cada deploy o
   reinicio se pierden las imágenes que no estén en un *Persistent Disk*. Los registros quedan con
   rutas que dan 404. (Verifica si tu servicio tiene disco persistente montado en `uploads`.)
2. **Archivos públicos sin control:** cualquiera con la URL ve la foto, incluso de reportes ocultos
   por moderación o eliminados. El UUID evita adivinarlas, pero no hay revocación.
3. **No escala horizontalmente:** con dos instancias de la API cada una tiene su propio disco.
4. **Validación por MIME declarado:** un archivo no-imagen con MIME `image/png` llegaba a sharp y
   producía **500**. *Corregido:* ahora sharp valida el contenido, limita píxeles (80 MP) y responde 400.
5. **Peso en listas:** tarjetas y popups cargaban la imagen de 1600 px. *Corregido* para reportes
   nuevos con la variante de 640 px (los antiguos siguen usando la grande).
6. **Fotos grandes rechazadas:** fotos de 10–12 MB de celulares recientes superaban los 8 MB y se
   rechazaban. *Corregido* con la compresión en el navegador.

### Propuesta de arquitectura

```
Navegador ──(1) POST /api/reports (multipart)──► API ──sharp──► S3 (bucket privado)
                                                     └─► BD guarda la "key" (no la URL)
Navegador ◄──(2) JSON con URL firmada (GET, 1 h)── API
Navegador ──(3) GET URL firmada ──► CloudFront ──► S3
```

- **Bucket privado** (Block Public Access activado), cifrado SSE-S3, versionado opcional.
- **Seguir subiendo a través de la API** (no *presigned PUT* directo) para conservar lo que ya
  hace sharp: quitar el GPS de la foto, validar el contenido y generar variantes. Con fotos ya
  comprimidas en el navegador la carga extra para la API es baja.
- **Lectura con URLs firmadas** (CloudFront signed URLs o S3 presigned GET, ~1 h). Así un reporte
  oculto o eliminado deja de servir sus fotos con solo no firmarlas.
  - Alternativa más simple: prefijo público solo para fotos de reportes visibles y privado para
    evidencias; es más barato pero se pierde la revocación.
- **CloudFront** delante del bucket: menor latencia en México y menos costo de transferencia
  que servir directo desde S3.
- **Implementación:** nueva clase `S3StorageAdapter` que cumpla la interfaz `StorageAdapter`
  existente (`saveReportImage`, `remove`) y una variable `STORAGE_DRIVER=local|s3`. El resto del
  código no cambia. Las URLs se resolverían en el serializador (`key` → URL firmada).
- **Límites:** mantener 8 MB y JPG/PNG/WEBP/HEIC; validar con sharp; `limitInputPixels`.
- **Costos estimados** (us-east-1, orientativo): ~0.25 MB por reporte con sus 3 variantes →
  10 000 reportes ≈ 2.5 GB ≈ 0.06 USD/mes de almacenamiento. El costo real está en la
  transferencia (CloudFront: primer 1 TB/mes incluido en la capa gratuita actual).

### Estrategia de migración segura (no ejecutada)

1. Activar `STORAGE_DRIVER=s3` solo para **imágenes nuevas** (el adaptador acepta leer ambas
   formas: ruta `/uploads/...` local o `key` de S3).
2. Script de copia **idempotente**: sube cada archivo de `uploads/` a S3 con la misma ruta,
   verifica tamaño/ETag y registra el resultado. **No borra nada.**
3. Cambiar las referencias en la BD por lotes y dentro de transacciones, guardando un respaldo
   (tabla o CSV con id → ruta anterior).
4. Mantener `uploads/` y el `express.static` durante un periodo de convivencia.
5. Solo después de verificar, archivar o eliminar los archivos locales.

Consecuencias de migrar sin esta estrategia: imágenes perdidas si el disco ya se reinició, enlaces
rotos en reportes históricos y en el PDF, y caché del service worker apuntando a rutas viejas.

### Qué falta

Cuenta de AWS, bucket, usuario IAM con permisos mínimos (`s3:PutObject`, `s3:GetObject`,
`s3:DeleteObject` sobre el bucket), distribución de CloudFront y variables
`AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (o rol de IAM).

---

## 4. Rendimiento: causas encontradas y cambios

| Causa | Impacto | Cambio |
|---|---|---|
| Sin índices en `reports.userId`, `categoryId`, `status`, `createdAt`, `report_history.reportId`, `report_flags.reportId` (Postgres no indexa FKs) | "Mis reportes", detalle con historial, filtros y moderación recorren toda la tabla | Índices creados con `CREATE INDEX IF NOT EXISTS` (migración no destructiva) |
| `computeStats` traía **todas** las columnas (incluida la descripción TEXT) y recorría la lista ~30 veces | Dashboard lento con muchos reportes | Consulta con columnas mínimas (`raw`) y agregación en una sola pasada |
| Conteo de votos con `IN (miles de ids)` | Consulta enorme | `JOIN` con filtro por rango |
| `/admin/stats` devolvía 20 reportes que nadie usaba | Respuesta más pesada | Eliminado |
| Tabla de admin: hasta 500 filas sin paginar y búsqueda **en cada tecla** | Muchas peticiones y render pesado | Paginación (50) + debounce de 350 ms |
| Todo el JS en un solo archivo (Mapbox 1.9 MB + Recharts 0.4 MB) | Login y "Mis reportes" tardaban en abrir | Carga diferida por ruta: JS inicial ≈ 416 KB (139 KB gzip) |
| Tarjetas con imagen de 1600 px | Listas lentas en datos móviles | Variante de 640 px |
| Fotos de 5–12 MB subidas tal cual | Subida lenta desde el celular | Compresión en el navegador |
| Pines del mapa (DOM) se recreaban en cada render (popup, panel, refresco cada minuto) | Mapa trabado con cientos de reportes | Marcadores memorizados |
| `invalidateQueries()` sin filtro tras cada acción | Recargaba todo lo activo | Invalidación dirigida en el código nuevo (pendiente en los paneles de moderación existentes) |
| Pantallas en blanco o "Cargando…" | Percepción de lentitud | Skeletons, estados de error con reintento, datos previos al cambiar filtros |

---

## 5. Códigos por correo: diagnóstico

**Causa real de que "no lleguen":** `SMTP_HOST=sandbox.smtp.mailtrap.io`. Las credenciales son
correctas (la conexión SMTP se verificó con éxito), pero el **sandbox** de Mailtrap nunca entrega
a buzones reales: los correos solo aparecen en la bandeja de pruebas de Mailtrap. Además,
`MAIL_FROM` usa `@geoscript.local`, un dominio que los proveedores reales rechazan o mandan a spam.

**Problemas de seguridad corregidos:**

- El código se buscaba **solo por los 6 dígitos**: con varios códigos activos, un intento al azar
  podía coincidir con el de **otra** persona (incluido un reseteo de password). Ahora se valida
  **correo + código**, y tras 5 intentos fallidos el código se invalida.
- "Olvidé mi password" revelaba si un correo estaba registrado; ahora responde igual en ambos casos.
- El nombre del usuario se insertaba sin escapar en el HTML del correo.
- Sin tiempo límite, un SMTP caído dejaba el registro colgado ~2 min; ahora 10–20 s.

**Para que lleguen de verdad**, configurar en `backend/.env` un SMTP real, por ejemplo Gmail:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=tucuenta@gmail.com
SMTP_PASS=<contraseña de aplicación de 16 letras>
MAIL_FROM="GeoScript <tucuenta@gmail.com>"
```

(o Brevo / Mailtrap *Sending* / Amazon SES con un dominio verificado). Después:
`npm run mail:test -- tu@correo.com`. Al arrancar, la API indica en consola si la conexión SMTP
funciona y si la configuración impide la entrega.
