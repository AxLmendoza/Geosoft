import { useEffect, useState } from 'react'
import { Marker, useMap } from 'react-map-gl/mapbox'
import { MapPinIcon } from '@heroicons/react/24/solid'
import { isInsideZone, ZONE_NAME } from '@/lib/mapConfig'
import { useGeolocation, type Coords } from '@/hooks/useGeolocation'
import BaseMap from './BaseMap'
import { PickerPin } from './pinIcons'

type Props = { value: Coords | null; onChange: (c: Coords) => void }

function Recenter({ value }: { value: Coords | null }) {
  const { current: map } = useMap()
  useEffect(() => {
    if (map && value) map.easeTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 16) })
  }, [value, map])
  return null
}

export default function LocationPicker({ value, onChange }: Props) {
  const { locate, loading, error } = useGeolocation()
  const [outside, setOutside] = useState(false)

  // Solo aceptamos la ubicación del GPS si cae dentro de la zona
  const useMyLocation = () =>
    locate()
      .then((c) => {
        const ok = isInsideZone(c)
        setOutside(!ok)
        if (ok) onChange(c)
      })
      .catch(() => undefined)

  // Al abrir el formulario intentamos usar la ubicación actual
  useEffect(() => {
    if (!value) useMyLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="relative h-72 overflow-hidden rounded-xl ring-1 ring-slate-300">
        <BaseMap center={value ?? undefined} zoom={15} onClick={(e) => onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng })}>
          <Recenter value={value} />
          {value && (
            <Marker
              longitude={value.lng}
              latitude={value.lat}
              anchor="bottom"
              draggable
              onDragEnd={(e) => onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
            >
              <PickerPin />
            </Marker>
          )}
          <button type="button" onClick={useMyLocation} className="glass-btn absolute bottom-8 right-2 z-10">
            <MapPinIcon className={`size-4 ${loading ? 'animate-pulse' : ''}`} /> Mi ubicación
          </button>
        </BaseMap>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {error ? `${error}. ` : ''}
        {outside ? `Tu ubicación está fuera de ${ZONE_NAME}. ` : ''}
        Toca el mapa o arrastra el pin para marcar el lugar exacto.
      </p>
    </div>
  )
}
