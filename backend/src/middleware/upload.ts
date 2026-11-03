import multer from 'multer'

const MAX_MB = Number(process.env.MAX_UPLOAD_MB ?? 8)
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/**
 * Se guarda en memoria y luego el StorageAdapter la optimiza con sharp
 * y la escribe en la carpeta local /uploads.
 */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true)
    else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'))
  },
}).single('image')
