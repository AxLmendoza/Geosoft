import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Popup, useMap } from 'react-map-gl/mapbox'
import { toast } from 'react-toastify'
import Supercluster from 'supercluster'
import { MapPinIcon } from '@heroicons/react/24/solid'
import { isInsideZone, ZONE_NAME } from '@/lib/mapConfig'
import { useGeolocation, type Coords } from '@/hooks/useGeolocation'
import BaseMap from './BaseMap'
import { ClusterPin, MePin, ReportPin, isCriticalOpen, pinGroup, type ClusterCounts } from './pinIcons'
import ReportPopup, { ReportPickList } from './ReportPopup'
import type { Report } from '@/types'

/** Zoom a partir del cual los grupos ya no se separan más: lo que quede junto se elige de una lista */
const CLUSTER_MAX_ZOOM = 18
/** Radio de agrupación en px: pines a menos de esta distancia en pantalla se agrupan */
const CLUSTER_RADIUS = 52

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

type PointProps = { id: number; group: ReturnType<typeof pinGroup>; critical: boolean }
type Counts = ClusterCounts

const emptyCounts = (): Counts => ({ recibido: 0, atencion: 0, resuelto: 0, otro: 0, critica: 0 })

/**
 * Agrupación (clustering) con supercluster: se calcula en el navegador al terminar cada movimiento.
 * Solo se dibujan los marcadores visibles, así cientos de reportes no saturan el mapa.
 */
function useClusters(reports: Report[]) {
  const { current: map } = useMap()
  const [view, setView] = useState<{ bbox: [number, number, number, number]; zoom: number } | null>(null)

  const index = useMemo(() => {
    const sc = new Supercluster<PointProps, Counts>({
      radius: CLUSTER_RADIUS,
      maxZoom: CLUSTER_MAX_ZOOM,
      map: (p) => ({ ...emptyCounts(), [p.group]: 1, critica: p.critical ? 1 : 0 }),
      reduce: (acc, p) => {
        acc.recibido += p.recibido
        acc.atencion += p.atencion
        acc.resuelto += p.resuelto
        acc.otro += p.otro
        acc.critica += p.critica
      },
    })
    sc.load(
      reports.map((r) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] },
        properties: { id: r.id, group: pinGroup(r.status), critical: isCriticalOpen(r) },
      })),
    )
    return sc
  }, [reports])

  useEffect(() => {
    if (!map) return
    const update = () => {
      const b = map.getBounds()
      if (!b) return
      setView({ bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: map.getZoom() })
    }
    update()
    map.on('moveend', update)
    map.on('load', update)
    return () => {
      map.off('moveend', update)
      map.off('load', update)
    }
  }, [map])

  const clusters = useMemo(
    () => (view ? index.getClusters(view.bbox, Math.min(Math.floor(view.zoom), CLUSTER_MAX_ZOOM)) : []),
    [index, view],
  )
  return { index, clusters, map }
}

type Selection = { kind: 'report'; report: Report } | { kind: 'list'; reports: Report[]; lng: number; lat: number }

/**
 * Rendimiento: los marcadores son elementos DOM; se memorizan para que abrir una tarjeta o el
 * refresco cada minuto no vuelva a crear todos si la lista y la vista no cambiaron.
 */
const Markers = memo(function Markers({
  reports,
  selectedId,
  onSelect,
  onList,
}: {
  reports: Report[]
  selectedId: number | null
  onSelect: (r: Report) => void
  onList: (rs: Report[], lng: number, lat: number) => void
}) {
  const { index, clusters, map } = useClusters(reports)
  const byId = useMemo(() => new Map(reports.map((r) => [r.id, r])), [reports])

  return (
    <>
      {clusters.map((f) => {
        const [lng, lat] = f.geometry.coordinates
        if ('cluster' in f.properties && f.properties.cluster) {
          const { cluster_id: clusterId, point_count: count } = f.properties
          return (
            <Marker
              key={`c-${clusterId}`}
              longitude={lng}
              latitude={lat}
              anchor="center"
              style={{ zIndex: 3 }}
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                const next = index.getClusterExpansionZoom(clusterId)
                if (next > CLUSTER_MAX_ZOOM || (map && map.getZoom() >= CLUSTER_MAX_ZOOM)) {
                  // Mismo punto (o casi): no se separan con el zoom, se elige de una lista
                  const leaves = index.getLeaves(clusterId, 50).map((l) => byId.get(l.properties.id)).filter((r): r is Report => !!r)
                  onList(leaves, lng, lat)
                } else {
                  map?.easeTo({ center: [lng, lat], zoom: next + 0.2, duration: 500 })
                }
              }}
            >
              <ClusterPin count={count} counts={f.properties as unknown as Counts} />
            </Marker>
          )
        }
        const report = byId.get((f.properties as PointProps).id)
        if (!report) return null
        const selected = report.id === selectedId
        return (
          <Marker
            key={report.id}
            longitude={lng}
            latitude={lat}
            anchor="bottom"
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

/** En celular: centra el pin elegido por encima de la hoja inferior */
function useFocusOnSelect(narrow: boolean) {
  const { current: map } = useMap()
  return useCallback(
    (lng: number, lat: number) => {
      if (!map) return
      if (narrow) map.easeTo({ center: [lng, lat], offset: [0, -120], duration: 400 })
    },
    [map, narrow],
  )
}

function SelectionLayer({ selection, setSelection, narrow }: { selection: Selection | null; setSelection: (s: Selection | null) => void; narrow: boolean }) {
  const { current: map } = useMap()
  const focus = useFocusOnSelect(narrow)

  // En celular la hoja inferior no es un popup de Mapbox: tocar el mapa vacío la cierra
  useEffect(() => {
    if (!map || !narrow || !selection) return
    const close = () => setSelection(null)
    map.on('click', close)
    return () => {
      map.off('click', close)
    }
  }, [map, narrow, selection, setSelection])
  useEffect(() => {
    if (!selection) return
    if (selection.kind === 'report') focus(selection.report.lng, selection.report.lat)
    else focus(selection.lng, selection.lat)
  }, [selection, focus])

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
  const content =
    selection.kind === 'report' ? (
      <ReportPopup report={selection.report} onClose={close} layout={narrow ? 'sheet' : 'popup'} />
    ) : (
      <ReportPickList reports={selection.reports} onClose={close} onPick={(r) => setSelection({ kind: 'report', report: r })} />
    )

  if (narrow) {
    // Hoja inferior: nunca se sale de la pantalla, deja ver el pin seleccionado y la atribución de Mapbox
    return (
      <div className="absolute inset-x-2 z-30" style={{ bottom: 'calc(1.75rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-sm">{content}</div>
      </div>
    )
  }
  const lng = selection.kind === 'report' ? selection.report.lng : selection.lng
  const lat = selection.kind === 'report' ? selection.report.lat : selection.lat
  return (
    <Popup
      longitude={lng}
      latitude={lat}
      offset={selection.kind === 'report' ? POPUP_OFFSET : 26}
      maxWidth="300px"
      closeButton={false}
      closeOnClick
      focusAfterOpen={false}
      className="gs-popup"
      onClose={close}
    >
      {content}
    </Popup>
  )
}

type Props = { reports: Report[]; className?: string; fullscreen?: boolean }

export default function ReportMap({ reports, className = '', fullscreen = false }: Props) {
  const [me, setMe] = useState<Coords | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const narrow = useNarrow()

  // Si un filtro o el refresco sacan al reporte abierto, se cierra; si cambió, se actualiza
  useEffect(() => {
    if (selection?.kind !== 'report') return
    const fresh = reports.find((r) => r.id === selection.report.id)
    if (!fresh) setSelection(null)
    else if (fresh !== selection.report) setSelection({ kind: 'report', report: fresh })
  }, [reports, selection])

  const onSelect = useCallback((r: Report) => setSelection({ kind: 'report', report: r }), [])
  const onList = useCallback((rs: Report[], lng: number, lat: number) => setSelection({ kind: 'list', reports: rs, lng, lat }), [])
  const selectedId = selection?.kind === 'report' ? selection.report.id : null

  return (
    <div className={`relative overflow-hidden ${fullscreen ? 'h-full w-full' : 'glass rounded-2xl'} ${className}`}>
      <BaseMap zoom={13} initialPitch={0} simplified showZone={!fullscreen} overlayClassName={fullscreen ? 'left-3 bottom-9' : undefined}>
        <FitToReports reports={reports} />
        <Markers reports={reports} selectedId={selectedId} onSelect={onSelect} onList={onList} />
        {me && (
          <Marker longitude={me.lng} latitude={me.lat} anchor="center">
            <MePin />
          </Marker>
        )}
        <SelectionLayer selection={selection} setSelection={setSelection} narrow={narrow} />
        {!(narrow && selection) && <LocateButton onLocated={setMe} />}
      </BaseMap>
    </div>
  )
}
