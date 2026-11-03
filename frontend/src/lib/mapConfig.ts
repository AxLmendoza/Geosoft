import type { Coords } from '@/hooks/useGeolocation'

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

/** Estilo Standard: incluye edificios 3D, monumentos y árboles donde Mapbox tiene datos */
export const MAP_STYLE = 'mapbox://styles/mapbox/standard'

/** Zona de trabajo: Tecamachalco, Puebla */
export const ZONE_NAME = 'Tecamachalco, Puebla'
export const DEFAULT_CENTER: Coords = { lat: 18.8826, lng: -97.7316 }

/** Límites [[oeste, sur], [este, norte]]: el mapa no deja salir de aquí */
export const MAP_BOUNDS: [[number, number], [number, number]] = [
  [-97.86, 18.79],
  [-97.6, 18.98],
]

export const MIN_ZOOM = 11.5
export const PITCH_3D = 60

export function isInsideZone({ lat, lng }: Coords) {
  const [[w, s], [e, n]] = MAP_BOUNDS
  return lng >= w && lng <= e && lat >= s && lat <= n
}
