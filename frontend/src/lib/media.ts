import { API_URL } from './axios'

/** Las imágenes se guardan en el servidor como /uploads/... */
export const assetUrl = (path: string) => (path.startsWith('http') ? path : `${API_URL}${path}`)

/** Versión mediana (~640px) para tarjetas y popups; los reportes antiguos usan la completa */
export const cardImage = (r: { mediumUrl?: string | null; imageUrl: string }) => assetUrl(r.mediumUrl || r.imageUrl)

const MAX_SIDE = 2000
const COMPRESS_OVER = 1.5 * 1024 * 1024

/**
 * Reduce en el navegador las fotos grandes del celular (5–12 MB) antes de subirlas.
 * El servidor las optimiza igual, pero así la subida con datos móviles es varias veces
 * más rápida. Si el navegador no puede decodificar el formato (p. ej. HEIC fuera de Safari)
 * se sube el archivo original sin cambios.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.size < COMPRESS_OVER || !file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
