import { isAxiosError } from 'axios'

/** Extrae el mensaje de error que manda la API ({ error: '...' }) */
export function getErrorMessage(error: unknown, fallback = 'Ocurrió un error, intenta de nuevo') {
  if (isAxiosError(error)) {
    if (!error.response) return 'Sin conexión con el servidor'
    return error.response.data?.error ?? fallback
  }
  return error instanceof Error ? error.message : fallback
}

export function getErrorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? error.response?.data?.code : undefined
}

/** Para usar en mutationFn: re-lanza el error con el mensaje de la API */
export function rethrow(error: unknown): never {
  const err = new Error(getErrorMessage(error)) as Error & { code?: string }
  err.code = getErrorCode(error)
  throw err
}
