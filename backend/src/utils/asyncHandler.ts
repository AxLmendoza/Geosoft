import type { Request, Response, NextFunction, RequestHandler } from 'express'

/** Express 4 no captura errores de funciones async: esto los manda al errorHandler */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }
