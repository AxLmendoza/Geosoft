import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

export type StoredImage = { imageUrl: string; thumbUrl: string; mediumUrl: string }

/**
 * Patrón Adapter: el resto de la app solo conoce esta interfaz.
 * Hoy guardamos en disco; la propuesta para Amazon S3 está en docs/PROPUESTAS.md
 * y solo requiere otra implementación de esta interfaz.
 */
export interface StorageAdapter {
  saveReportImage(buffer: Buffer): Promise<StoredImage>
  remove(publicPaths: (string | null | undefined)[]): Promise<void>
}

/** El archivo dice ser imagen pero sharp no lo puede decodificar (corrupto o disfrazado) */
export class InvalidImageError extends Error {
  constructor() {
    super('El archivo no es una imagen válida')
  }
}

export const UPLOAD_ROOT = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads')
const REPORTS_DIR = path.join(UPLOAD_ROOT, 'reports')

/** Variantes que se generan de cada foto */
const VARIANTS = [
  { suffix: '', size: 1600, fit: 'inside' as const, quality: 80 }, // detalle
  { suffix: '_md', size: 640, fit: 'inside' as const, quality: 75 }, // tarjetas y popups
  { suffix: '_thumb', size: 160, fit: 'cover' as const, quality: 70 }, // listas
]

class LocalStorageAdapter implements StorageAdapter {
  async saveReportImage(buffer: Buffer) {
    await fs.mkdir(REPORTS_DIR, { recursive: true })
    const id = randomUUID()

    // rotate() respeta la orientación EXIF de las fotos tomadas con el celular
    // y al re-codificar se eliminan los metadatos (incluido el GPS de la foto).
    // failOn 'error' + limitInputPixels evitan archivos corruptos o "bombas" de píxeles.
    const base = sharp(buffer, { failOn: 'error', limitInputPixels: 80_000_000 }).rotate()
    try {
      await base.metadata()
    } catch {
      throw new InvalidImageError()
    }

    const written: string[] = []
    try {
      for (const v of VARIANTS) {
        const file = `${id}${v.suffix}.webp`
        await base
          .clone()
          .resize(v.size, v.size, { fit: v.fit, withoutEnlargement: v.fit === 'inside' })
          .webp({ quality: v.quality })
          .toFile(path.join(REPORTS_DIR, file))
        written.push(`/uploads/reports/${file}`)
      }
    } catch {
      await this.remove(written)
      throw new InvalidImageError()
    }
    const [imageUrl, mediumUrl, thumbUrl] = written
    return { imageUrl, mediumUrl, thumbUrl }
  }

  async remove(publicPaths: (string | null | undefined)[]) {
    await Promise.all(
      publicPaths.filter((p): p is string => !!p).map(async (p) => {
        const file = path.join(UPLOAD_ROOT, p.replace(/^\/uploads\//, ''))
        if (!file.startsWith(UPLOAD_ROOT)) return
        await fs.unlink(file).catch(() => undefined)
      }),
    )
  }
}

export const storage: StorageAdapter = new LocalStorageAdapter()
