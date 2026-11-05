import { memo, useEffect, useRef, useState } from 'react'
import { Marker, Popup, useMap } from 'react-map-gl/mapbox'
import { toast } from 'react-toastify'
import { MapPinIcon } from '@heroicons/react/24/solid'
import { isInsideZone, PITCH_3D, ZONE_NAME } from '@/lib/mapConfig'
import { useGeolocation, type Coords } from '@/hooks/useGeolocation'
import BaseMap from './BaseMap'
import { MePin, ReportPin } from './pinIcons'
import ReportPopup from './ReportPopup'
import type { Report } from '@/types'

/** Ajusta la vista a los reportes solo la primera vez que llegan */
function FitToReports({ reports }: { reports: Report[] }) {
  const { current: map } = useMap()
  const done = useRef(false)
  useEffect(() => {
    const inside = reports.filter(isInsideZone)
    if (!map || done.current || inside.length === 0) return
    done.current = true
    const lngs = inside.map((r) => r.lng)
    const lats = inside.map((r) => r.lat)
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 60, maxZoom: 15, pitch: PITCH_3D, duration: 1200 },
    )
  }, [reports, map])
  return null
}

function LocateButton({ onLocated }: { onLocated: (c: Coords) => void }) {
  const { current: map } = useMap()
  const { locate, loading } = useGeolocation()
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          const c = await locate()
          if (!isInsideZone(c)) {
            toast.info(`Tu ubicación está fuera de ${ZONE_NAME}`)
            return
          }
          onLocated(c)
          map?.flyTo({ center: [c.lng, c.lat], zoom: 16 })
        } catch {
          /* el hook ya guarda el error */
        }
      }}
      className="glass-btn absolute bottom-8 right-3 z-10 !px-3 !py-2 !text-sm"
    >
      <MapPinIcon className={`size-4 ${loading ? 'animate-pulse' : ''}`} aria-hidden />
      {loading ? 'Ubicando…' : 'Cerca de mí'}
    </button>
  )
}

/**
 * Rendimiento: los pines son elementos DOM (uno por reporte). Se memorizan para que
 * abrir un popup, cambiar de panel o el refresco cada minuto no vuelva a crear cientos
 * de marcadores si la lista no cambió (React Query conserva la misma referencia).
 */
const Pins = memo(function Pins({ reports, onSelect }: { reports: Report[]; onSelect: (r: Report) => void }) {
  return (
    <>
      {reports.map((r) => (
        <Marker
          key={r.id}
          longitude={r.lng}
          latitude={r.lat}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation()
            onSelect(r)
          }}
        >
          <ReportPin report={r} />
        </Marker>
      ))}
    </>
  )
})

type Props = { reports: Report[]; className?: string; fullscreen?: boolean }

export default function ReportMap({ reports, className = '', fullscreen = false }: Props) {
  const [me, setMe] = useState<Coords | null>(null)
  const [selected, setSelected] = useState<Report | null>(null)

  // Si un filtro saca del listado al reporte abierto, cerramos su popup
  useEffect(() => {
    if (selected && !reports.some((r) => r.id === selected.id)) setSelected(null)
  }, [reports, selected])

  return (
    <div className={`relative overflow-hidden ${fullscreen ? 'h-full w-full' : 'glass rounded-2xl'} ${className}`}>
      <BaseMap zoom={13} overlayClassName={fullscreen ? 'left-3 bottom-9' : undefined}>
        <FitToReports reports={reports} />
        <Pins reports={reports} onSelect={setSelected} />
        {selected && (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="bottom"
            offset={64}
            maxWidth="280px"
            className="gs-popup"
            onClose={() => setSelected(null)}
          >
            <ReportPopup report={selected} />
          </Popup>
        )}
        {me && (
          <Marker longitude={me.lng} latitude={me.lat} anchor="center">
            <MePin />
          </Marker>
        )}
        <LocateButton onLocated={setMe} />
      </BaseMap>
    </div>
  )
}
