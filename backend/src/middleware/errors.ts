import type { Request, Response, NextFunction } from 'express'
import multer from 'multer'

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Ruta no encontrada' })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? `La imagen supera ${process.env.MAX_UPLOAD_MB ?? 8} MB`
        : 'Solo se permiten imágenes JPG, PNG, WEBP o HEIC'
    res.status(400).json({ error: msg })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
}
