import { useCallback, useState } from 'react'

export type Coords = { lat: number; lng: number }

export function useGeolocation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locate = useCallback(
    () =>
      new Promise<Coords>((resolve, reject) => {
        if (!('geolocation' in navigator)) {
          const msg = 'Tu dispositivo no permite obtener la ubicación'
          setError(msg)
          return reject(new Error(msg))
        }
        setLoading(true)
        setError(null)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLoading(false)
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          },
          (err) => {
            setLoading(false)
            const msg = err.code === err.PERMISSION_DENIED ? 'Permiso de ubicación denegado' : 'No se pudo obtener tu ubicación'
            setError(msg)
            reject(new Error(msg))
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
        )
      }),
    [],
  )

  return { locate, loading, error }
}
