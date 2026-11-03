import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

/**
 * Patrón Adapter: el resto de la app solo conoce esta interfaz.
 * Hoy guardamos en disco; mañana se puede cambiar por S3, etc.
 */
export interface StorageAdapter {
  saveReportImage(buffer: Buffer): Promise<{ imageUrl: string; thumbUrl: string }>
  remove(publicPaths: string[]): Promise<void>
}

export const UPLOAD_ROOT = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads')
const REPORTS_DIR = path.join(UPLOAD_ROOT, 'reports')

class LocalStorageAdapter implements StorageAdapter {
  async saveReportImage(buffer: Buffer) {
    await fs.mkdir(REPORTS_DIR, { recursive: true })
    const id = randomUUID()
    const full = `${id}.webp`
    const thumb = `${id}_thumb.webp`

    // rotate() respeta la orientación EXIF de las fotos tomadas con el celular
    // y al re-codificar se eliminan los metadatos (incluido el GPS de la foto)
    await sharp(buffer)
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(REPORTS_DIR, full))

    await sharp(buffer)
      .rotate()
      .resize(160, 160, { fit: 'cover' })
      .webp({ quality: 70 })
      .toFile(path.join(REPORTS_DIR, thumb))

    return { imageUrl: `/uploads/reports/${full}`, thumbUrl: `/uploads/reports/${thumb}` }
  }

  async remove(publicPaths: string[]) {
    await Promise.all(
      publicPaths.map(async (p) => {
        const file = path.join(UPLOAD_ROOT, p.replace(/^\/uploads\//, ''))
        if (!file.startsWith(UPLOAD_ROOT)) return
        await fs.unlink(file).catch(() => undefined)
      }),
    )
  }
}

export const storage: StorageAdapter = new LocalStorageAdapter()
