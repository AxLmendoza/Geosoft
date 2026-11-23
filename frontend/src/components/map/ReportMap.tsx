import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Popup, useMap } from 'react-map-gl/mapbox'
import { toast } from 'react-toastify'
import { MapPinIcon } from '@heroicons/react/24/solid'
import { isInsideZone, ZONE_NAME } from '@/lib/mapConfig'
import { useGeolocation, type Coords } from '@/hooks/useGeolocation'
import { spreadPins, type Offset } from '@/lib/spreadPins'
import BaseMap from './BaseMap'
import { MePin, ReportPin } from './pinIcons'
import ReportPopup from './ReportPopup'
import type { Report } from '@/types'

/** Margen fuera de la pantalla en el que también se dibujan pines (fracción del ancho/alto visible) */
const VIEW_MARGIN = 0.25

/**
 * Desplazamiento del popup según hacia dónde abra (Mapbox elige el lado que cabe en pantalla).
 * El pin seleccionado mide ~51 px de alto (43 px × 1.18): la flecha queda justo encima de la placa.
 */
const POPUP_OFFSET = {
  top: [0, 6], 'top-left': [0, 6], 'top-right': [0, 6],
  bottom: [0, -54], 'bottom-left': [0, -54], 'bottom-right': [0, -54],
  left: [24, -28], right: [-24, -28],
} as Record<string, [number, number]>

/** Ancho de celular: la tarjeta se muestra como hoja inferior en vez de popup */
function useNarrow() {
  const query = '(max-width: 639px)'
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

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
      { padding: 70, maxZoom: 15.5, duration: 900 },
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
      className="glass-btn absolute bottom-9 right-3 z-10"
    >
      <MapPinIcon className={`size-4 ${loading ? 'animate-pulse' : ''}`} aria-hidden />
      {loading ? 'Ubicando…' : 'Cerca de mí'}
    </button>
  )
}

/** Fijo para los pines sin abanico: react-map-gl ignora offset=undefined y el pin no volvería a su lugar */
const NO_OFFSET: Offset = [0, 0]
type Layout = { visible: Report[]; offsets: Map<number, Offset>; centers: { key: string; lng: number; lat: number }[] }

/**
 * Sin agrupación: cada reporte tiene su propio pin.
 * - Solo se dibujan los que están a la vista (más un margen): cientos de reportes no saturan el DOM.
 * - Los que caen en el mismo punto, o tan cerca que se taparían, se abren en abanico alrededor
 *   de ese punto (desplazamiento en px; la coordenada real no cambia) para que cada uno se pueda tocar.
 * Se recalcula al terminar cada movimiento del mapa.
 */
function useSpreadLayout(reports: Report[]): Layout {
  const { current: map } = useMap()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!map) return
    const update = () => setTick((t) => t + 1)
    map.on('moveend', update)
    map.on('load', update)
    return () => {
      map.off('moveend', update)
      map.off('load', update)
    }
  }, [map])

  return useMemo(() => {
    const empty: Layout = { visible: [], offsets: new Map(), centers: [] }
    const b = map?.getBounds()
    if (!map || !b) return empty
    const padLng = (b.getEast() - b.getWest()) * VIEW_MARGIN
    const padLat = (b.getNorth() - b.getSouth()) * VIEW_MARGIN
    const visible = reports.filter(
      (r) => r.lng >= b.getWest() - padLng && r.lng <= b.getEast() + padLng && r.lat >= b.getSouth() - padLat && r.lat <= b.getNorth() + padLat,
    )
    // Abanico calculado en pantalla (px); los centros se devuelven a coordenadas del mapa
    const { offsets, centers } = spreadPins(
      visible.map((r) => {
        const p = map.project([r.lng, r.lat])
        return { id: r.id, x: p.x, y: p.y }
      }),
    )
    return {
      visible,
      offsets,
      centers: centers.map((c) => {
        const { lng, lat } = map.unproject([c.x, c.y])
        return { key: c.key, lng, lat }
      }),
    }
    // tick: se recalcula al terminar cada movimiento del mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, reports, tick])
}

/**
 * Rendimiento: los marcadores son elementos DOM; se memorizan para que abrir una tarjeta o el
 * refresco cada minuto no vuelva a crear todos si la lista y la vista no cambiaron.
 */
const Markers = memo(function Markers({
  layout,
  selectedId,
  onSelect,
}: {
  layout: Layout
  selectedId: number | null
  onSelect: (r: Report) => void
}) {
  return (
    <>
      {/* Punto real de los pines abiertos en abanico */}
      {layout.centers.map((c) => (
        <Marker key={`s-${c.key}`} longitude={c.lng} latitude={c.lat} anchor="center" style={{ zIndex: 0, pointerEvents: 'none' }}>
          <span className="gs-spread-center" aria-hidden />
        </Marker>
      ))}
      {layout.visible.map((report) => {
        const selected = report.id === selectedId
        return (
          <Marker
            key={report.id}
            longitude={report.lng}
            latitude={report.lat}
            anchor="bottom"
            offset={layout.offsets.get(report.id) ?? NO_OFFSET}
            style={{ zIndex: selected ? 5 : report.severity === 'critica' ? 2 : 1 }}
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onSelect(report)
            }}
          >
            <ReportPin report={report} selected={selected} interactive />
          </Marker>
        )
      })}
    </>
  )
})

/** Desplazamiento del popup sumando el del pin cuando está abierto en abanico */
function popupOffset([dx, dy]: Offset) {
  return Object.fromEntries(Object.entries(POPUP_OFFSET).map(([k, [x, y]]) => [k, [x + dx, y + dy]])) as Record<string, [number, number]>
}

function SelectionLayer({
  selection,
  offset,
  setSelection,
  narrow,
}: {
  selection: Report | null
  offset: Offset
  setSelection: (s: Report | null) => void
  narrow: boolean
}) {
  const { current: map } = useMap()

  // En celular la hoja inferior no es un popup de Mapbox: tocar el mapa vacío la cierra
  useEffect(() => {
    if (!map || !narrow || !selection) return
    const close = () => setSelection(null)
    map.on('click', close)
    return () => {
      map.off('click', close)
    }
  }, [map, narrow, selection, setSelection])

  // En celular: centra el pin elegido (con su desplazamiento) por encima de la hoja inferior.
  // Solo al elegir otro reporte, no en cada refresco de datos.
  const selectedId = selection?.id
  useEffect(() => {
    if (!map || !narrow || !selection) return
    map.easeTo({ center: [selection.lng, selection.lat], offset: [-offset[0], -120 - offset[1]], duration: 400 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, narrow, selectedId])

  // Mientras hay una tarjeta abierta, los avisos flotantes (instalar la app) se ocultan para no taparla
  useEffect(() => {
    if (!selection) return
    document.body.dataset.mapCard = 'open'
    return () => {
      delete document.body.dataset.mapCard
    }
  }, [selection])

  // Esc cierra la tarjeta
  useEffect(() => {
    if (!selection) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelection(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, setSelection])

  if (!selection) return null
  const close = () => setSelection(null)

  if (narrow) {
    // Hoja inferior: nunca se sale de la pantalla, deja ver el pin seleccionado y la atribución de Mapbox
    return (
      <div className="absolute inset-x-2 z-30" style={{ bottom: 'calc(1.75rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-sm">
          <ReportPopup report={selection} onClose={close} layout="sheet" />
        </div>
      </div>
    )
  }
  return (
    <Popup
      longitude={selection.lng}
      latitude={selection.lat}
      offset={popupOffset(offset)}
      maxWidth="300px"
      closeButton={false}
      closeOnClick
      focusAfterOpen={false}
      className="gs-popup"
      onClose={close}
    >
      <ReportPopup report={selection} onClose={close} layout="popup" />
    </Popup>
  )
}


/** Pines y tarjeta: necesitan la instancia del mapa (useMap), por eso van dentro de <BaseMap> */
function ReportLayer({
  reports,
  selection,
  setSelection,
  narrow,
}: {
  reports: Report[]
  selection: Report | null
  setSelection: (s: Report | null) => void
  narrow: boolean
}) {
  const layout = useSpreadLayout(reports)
  const selectedId = selection?.id ?? null
  const offset = (selectedId !== null && layout.offsets.get(selectedId)) || NO_OFFSET
  return (
    <>
      <Markers layout={layout} selectedId={selectedId} onSelect={setSelection} />
      <SelectionLayer selection={selection} offset={offset} setSelection={setSelection} narrow={narrow} />
    </>
  )
}

type Props = { reports: Report[]; className?: string; fullscreen?: boolean }

export default function ReportMap({ reports, className = '', fullscreen = false }: Props) {
  const [me, setMe] = useState<Coords | null>(null)
  const [selection, setSelection] = useState<Report | null>(null)
  const narrow = useNarrow()

  // Si un filtro o el refresco sacan al reporte abierto, se cierra; si cambió, se actualiza
  useEffect(() => {
    if (!selection) return
    const fresh = reports.find((r) => r.id === selection.id)
    if (!fresh) setSelection(null)
    else if (fresh !== selection) setSelection(fresh)
  }, [reports, selection])

  const select = useCallback((r: Report | null) => setSelection(r), [])

  return (
    <div className={`relative overflow-hidden ${fullscreen ? 'h-full w-full' : 'glass rounded-2xl'} ${className}`}>
      <BaseMap zoom={13} initialPitch={0} simplified showZone={!fullscreen} overlayClassName={fullscreen ? 'left-3 bottom-9' : undefined}>
        <FitToReports reports={reports} />
        <ReportLayer reports={reports} selection={selection} setSelection={select} narrow={narrow} />
        {me && (
          <Marker longitude={me.lng} latitude={me.lat} anchor="center">
            <MePin />
          </Marker>
        )}
        {!(narrow && selection) && <LocateButton onLocated={setMe} />}
      </BaseMap>
    </div>
  )
}
