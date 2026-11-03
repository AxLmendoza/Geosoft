import { useState, type ReactNode } from 'react'
import Map, { NavigationControl, Source, useMap, type MapMouseEvent } from 'react-map-gl/mapbox'
import { CubeIcon, MapIcon } from '@heroicons/react/24/outline'
import { DEFAULT_CENTER, MAPBOX_TOKEN, MAP_BOUNDS, MAP_STYLE, MIN_ZOOM, PITCH_3D, ZONE_NAME } from '@/lib/mapConfig'
import type { Coords } from '@/hooks/useGeolocation'

type Props = {
  center?: Coords
  zoom?: number
  onClick?: (e: MapMouseEvent) => void
  /** Muestra la etiqueta de la zona y el botón 2D/3D */
  showOverlay?: boolean
  /** Posición de la etiqueta y el botón 2D/3D (para librar la barra lateral) */
  overlayClassName?: string
  children?: ReactNode
}

/** Alterna entre vista inclinada (3D) y vista cenital (2D) */
function ViewToggle() {
  const { current: map } = useMap()
  const [is3D, setIs3D] = useState(true)
  return (
    <button
      type="button"
      onClick={() => {
        map?.easeTo({ pitch: is3D ? 0 : PITCH_3D, bearing: is3D ? 0 : -17, duration: 800 })
        setIs3D(!is3D)
      }}
      className="glass-btn pointer-events-auto"
    >
      {is3D ? <MapIcon className="size-4" /> : <CubeIcon className="size-4" />}
      {is3D ? 'Vista 2D' : 'Vista 3D'}
    </button>
  )
}

/**
 * Mapa Mapbox limitado a Tecamachalco con relieve y edificios 3D.
 * Todos los mapas de la app parten de aquí para compartir estilo y límites.
 */
export default function BaseMap({ center = DEFAULT_CENTER, zoom = 14, onClick, showOverlay = true, overlayClassName = 'left-3 top-3', children }: Props) {
  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white/40 p-6 text-center text-sm text-slate-500">
        Falta configurar VITE_MAPBOX_TOKEN en el archivo .env para mostrar el mapa.
      </div>
    )
  }

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle={MAP_STYLE}
      initialViewState={{ longitude: center.lng, latitude: center.lat, zoom, pitch: PITCH_3D, bearing: -17 }}
      maxBounds={MAP_BOUNDS}
      minZoom={MIN_ZOOM}
      maxPitch={75}
      terrain={{ source: 'mapbox-dem', exaggeration: 1.3 }}
      onClick={onClick}
      style={{ width: '100%', height: '100%' }}
      cursor={onClick ? 'crosshair' : undefined}
    >
      <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />
      <NavigationControl position="top-right" visualizePitch />
      {showOverlay && (
        <div className={`pointer-events-none absolute z-10 flex flex-col items-start gap-2 ${overlayClassName}`}>
          <span className="glass-btn">{ZONE_NAME}</span>
          <ViewToggle />
        </div>
      )}
      {children}
    </Map>
  )
}
