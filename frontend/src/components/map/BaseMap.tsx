import { useEffect, useState, type ReactNode } from 'react'
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
  /** Inclinación inicial (0 = vista 2D cenital) */
  initialPitch?: number
  /**
   * Mapa base simplificado para que los reportes destaquen: oculta los iconos y etiquetas
   * de comercios (POI) y atenúa los colores. Conserva calles, colonias, relieve y la atribución.
   */
  simplified?: boolean
  children?: ReactNode
}

/** Propiedades de configuración del estilo Mapbox Standard (las desconocidas se ignoran) */
function simplifyBasemap(map: { setConfigProperty?: (importId: string, key: string, value: unknown) => void }) {
  try {
    map.setConfigProperty?.('basemap', 'showPointOfInterestLabels', false)
    map.setConfigProperty?.('basemap', 'theme', 'faded')
  } catch {
    /* estilo sin estas propiedades: se deja como está */
  }
}

/**
 * Mantiene el lienzo del mapa del mismo tamaño que su contenedor.
 *
 * Causa de la franja gris: Mapbox GL (v3) solo se redimensiona con el evento `resize` de la
 * VENTANA y mide el contenedor en ese instante. Si el contenedor cambia por otra razón (la barra
 * lateral aparece al pasar a escritorio, carga diferida, cambio de orientación, panel que se abre)
 * o se mide antes de que el layout termine, el <canvas> queda con el ancho viejo: más angosto
 * (franja gris a la derecha) o más ancho (mapa recortado). Aquí se observa el CONTENEDOR y se
 * llama a map.resize() una vez por cuadro de animación.
 */
function AutoResize() {
  const { current: map } = useMap()
  useEffect(() => {
    if (!map) return
    const container = map.getContainer()
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const canvas = map.getCanvas()
        // Solo si de verdad cambió: resize() fuerza un redibujado completo
        if (Math.round(canvas.clientWidth) !== container.clientWidth || Math.round(canvas.clientHeight) !== container.clientHeight) map.resize()
      })
    })
    observer.observe(container)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [map])
  return null
}

/** Alterna entre vista inclinada (3D) y vista cenital (2D) */
function ViewToggle({ initial3D }: { initial3D: boolean }) {
  const { current: map } = useMap()
  const [is3D, setIs3D] = useState(initial3D)
  return (
    <button
      type="button"
      onClick={() => {
        map?.easeTo({ pitch: is3D ? 0 : PITCH_3D, bearing: is3D ? 0 : -17, duration: 800 })
        setIs3D(!is3D)
      }}
      className="glass-btn pointer-events-auto"
      aria-pressed={is3D}
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
export default function BaseMap({ center = DEFAULT_CENTER, zoom = 14, onClick, showOverlay = true, overlayClassName = 'left-3 top-3', initialPitch = PITCH_3D, simplified = false, children }: Props) {
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
      initialViewState={{ longitude: center.lng, latitude: center.lat, zoom, pitch: initialPitch, bearing: initialPitch ? -17 : 0 }}
      maxBounds={MAP_BOUNDS}
      minZoom={MIN_ZOOM}
      maxPitch={75}
      terrain={{ source: 'mapbox-dem', exaggeration: 1.3 }}
      onClick={onClick}
      onLoad={simplified ? (e) => simplifyBasemap(e.target as never) : undefined}
      style={{ width: '100%', height: '100%' }}
      cursor={onClick ? 'crosshair' : undefined}
    >
      <AutoResize />
      <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />
      <NavigationControl position="top-right" visualizePitch />
      {showOverlay && (
        <div className={`pointer-events-none absolute z-10 flex flex-col items-start gap-2 ${overlayClassName}`}>
          <span className="glass-btn">{ZONE_NAME}</span>
          <ViewToggle initial3D={initialPitch > 0} />
        </div>
      )}
      {children}
    </Map>
  )
}
