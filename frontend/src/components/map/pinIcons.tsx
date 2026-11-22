import type { ComponentType, CSSProperties, SVGProps } from 'react'
import { CheckIcon, ClockIcon, NoSymbolIcon, UserIcon, WrenchScrewdriverIcon } from '@heroicons/react/20/solid'
import { STATUS } from '@/lib/labels'
import type { Report } from '@/types'

/**
 * Simbología del mapa de GeoScript: "señal" (placa redondeada con punta), un solo glifo.
 *
 * - Forma: placa = reporte · rombo = crítico abierto (como una señal preventiva).
 * - Glifo: la etapa del seguimiento (reloj, persona, herramienta, palomita…).
 * - Color: refuerza la etapa con 4 tonos + gris; nunca es la única pista.
 * - "Cerrado" usa la misma palomita que "Resuelto" pero en contorno (placa blanca).
 * La categoría NO va en el pin (evita iconos encimados): está en la tarjeta y en la lista.
 */
type Glyph = ComponentType<SVGProps<SVGSVGElement>>

/** "!" grueso: se lee mejor que un triángulo dentro de un rombo */
function Bang(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden {...props}>
      <rect x="8.1" y="2.5" width="3.8" height="10" rx="1.9" />
      <circle cx="10" cy="16.2" r="2.1" />
    </svg>
  )
}

export type PinKind = 'critico' | 'recibido' | 'asignado' | 'atencion' | 'resuelto' | 'cerrado' | 'fuera'

export const PIN_KINDS: Record<PinKind, { label: string; help: string; color: string; Glyph: Glyph; outline?: boolean }> = {
  critico: { label: 'Crítico', help: 'Gravedad crítica, aún sin resolver', color: '#dc2626', Glyph: Bang },
  recibido: { label: 'Recibido', help: 'Recibido o en validación', color: '#b45309', Glyph: ClockIcon },
  asignado: { label: 'Asignado', help: 'Ya tiene un área responsable', color: '#1d43d8', Glyph: UserIcon },
  atencion: { label: 'En atención', help: 'El personal está trabajando', color: '#1d43d8', Glyph: WrenchScrewdriverIcon },
  resuelto: { label: 'Resuelto', help: 'Solucionado recientemente', color: '#047857', Glyph: CheckIcon },
  cerrado: { label: 'Cerrado', help: 'Seguimiento terminado', color: '#047857', Glyph: CheckIcon, outline: true },
  fuera: { label: 'Canalizado o no procedente', help: 'Fuera de la ruta normal', color: '#475569', Glyph: NoSymbolIcon },
}

export const PIN_KIND_ORDER: PinKind[] = ['critico', 'recibido', 'asignado', 'atencion', 'resuelto', 'cerrado', 'fuera']

/** Grupos para los conteos de los clústeres (4 etapas) */
export type PinGroup = 'recibido' | 'atencion' | 'resuelto' | 'otro'

export const PIN_GROUPS: Record<PinGroup, { label: string; color: string }> = {
  recibido: { label: 'Por atender', color: PIN_KINDS.recibido.color },
  atencion: { label: 'En atención', color: PIN_KINDS.atencion.color },
  resuelto: { label: 'Resueltos', color: PIN_KINDS.resuelto.color },
  otro: { label: 'Canalizados o no procedentes', color: PIN_KINDS.fuera.color },
}
export const PIN_GROUP_ORDER: PinGroup[] = ['recibido', 'atencion', 'resuelto', 'otro']
export const CRITICAL_COLOR = PIN_KINDS.critico.color

export function pinGroup(status: Report['status']): PinGroup {
  if (status === 'pendiente' || status === 'en_revision') return 'recibido'
  if (status === 'asignado' || status === 'en_proceso') return 'atencion'
  if (status === 'resuelto' || status === 'cerrado') return 'resuelto'
  return 'otro'
}

export const isCriticalOpen = (r: Pick<Report, 'status' | 'severity'>) =>
  r.severity === 'critica' && (pinGroup(r.status) === 'recibido' || pinGroup(r.status) === 'atencion')

export function pinKind(r: Pick<Report, 'status' | 'severity'>): PinKind {
  if (isCriticalOpen(r)) return 'critico'
  switch (r.status) {
    case 'pendiente':
    case 'en_revision':
      return 'recibido'
    case 'asignado':
      return 'asignado'
    case 'en_proceso':
      return 'atencion'
    case 'resuelto':
      return 'resuelto'
    case 'cerrado':
      return 'cerrado'
    default:
      return 'fuera'
  }
}

/* ------------------------------------------------------------------ */

/** Placa redondeada con punta (viewBox 36×43; la punta toca el suelo en y≈39) */
const PLAQUE = 'M12 3H24A9 9 0 0 1 33 12V24A9 9 0 0 1 24 33H22.2L18 39.4L13.8 33H12A9 9 0 0 1 3 24V12A9 9 0 0 1 12 3Z'
/** Rombo (centro 18,18) con esquinas suaves y la misma punta al suelo (crítico) */
const DIAMOND = 'M15.88 4.12Q18 2 20.12 4.12L31.88 15.88Q34 18 31.88 20.12L21.5 30.5L18 39.4L14.5 30.5L4.12 20.12Q2 18 4.12 15.88Z'

/** Silueta del marcador (SVG nítido a cualquier escala) */
function PinShape({ kind, selected }: { kind: PinKind; selected: boolean }) {
  const { color, outline } = PIN_KINDS[kind]
  const d = kind === 'critico' ? DIAMOND : PLAQUE
  return (
    <svg viewBox="0 0 36 43" className="gs-pin__shape" aria-hidden>
      {/* Sombra de contacto: indica el punto exacto del reporte */}
      <ellipse cx="18" cy="41" rx={selected ? 6 : 3.5} ry={selected ? 2 : 1.5} className={selected ? 'gs-pin__ground--on' : 'gs-pin__ground'} />
      {/* Seleccionado: contorno azul marino por fuera del borde blanco */}
      {selected && <path d={d} fill="#0f172a" stroke="#0f172a" strokeWidth="6" strokeLinejoin="round" />}
      <path d={d} fill={outline ? '#ffffff' : color} stroke={outline ? color : '#ffffff'} strokeWidth={outline ? 2.5 : 2} strokeLinejoin="round" />
    </svg>
  )
}

/** Glifo de la etapa en una pastilla redonda (tarjeta, lista y simbología) */
export function PinBadge({ kind, size = 20 }: { kind: PinKind; size?: number }) {
  const { color, Glyph, outline } = PIN_KINDS[kind]
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: kind === 'critico' ? size * 0.22 : 9999,
        transform: kind === 'critico' ? 'rotate(45deg) scale(0.86)' : undefined,
        background: outline ? '#fff' : color,
        boxShadow: outline ? `inset 0 0 0 2px ${color}` : undefined,
        color: outline ? color : '#fff',
      }}
      aria-hidden
    >
      <Glyph style={{ width: size * 0.62, height: size * 0.62, transform: kind === 'critico' ? 'rotate(-45deg) scale(1.1)' : undefined }} />
    </span>
  )
}

/** El mismo marcador en tamaño pequeño y sin interacción (simbología) */
export function PinIcon({ kind, height = 30 }: { kind: PinKind; height?: number }) {
  const { color, outline, Glyph } = PIN_KINDS[kind]
  const d = kind === 'critico' ? DIAMOND : PLAQUE
  const width = (height * 36) / 43
  const glyph = height * (kind === 'critico' ? 0.3 : 0.36)
  return (
    <span className="relative inline-block shrink-0" style={{ width, height }} aria-hidden>
      <svg viewBox="0 0 36 43" width={width} height={height} style={{ overflow: 'visible', filter: 'drop-shadow(0 1px 1.5px rgb(15 23 42 / 0.3))' }}>
        <path d={d} fill={outline ? '#fff' : color} stroke={outline ? color : '#fff'} strokeWidth={outline ? 2.5 : 2} strokeLinejoin="round" />
      </svg>
      <Glyph
        style={{ position: 'absolute', width: glyph, height: glyph, left: (18 / 36) * width - glyph / 2, top: (18 / 43) * height - glyph / 2, color: outline ? color : '#fff' }}
      />
    </span>
  )
}

type PinProps = {
  report: Pick<Report, 'id' | 'title' | 'status' | 'severity' | 'category'>
  selected?: boolean
  /**
   * Se dibuja como <button> (foco y teclado). El clic lo maneja el <Marker> que lo contiene:
   * Mapbox recibe el evento antes que React, así que detenerlo desde React llegaría tarde.
   */
  interactive?: boolean
}

/**
 * Marcador de reporte: área táctil de 44×48 px, forma + glifo + color para la etapa.
 * Rojo y rombo solo para críticos abiertos; los cerrados se ven en contorno y atenuados.
 */
export function ReportPin({ report, selected = false, interactive = false }: PinProps) {
  const kind = pinKind(report)
  const { Glyph, color, outline } = PIN_KINDS[kind]
  const label = `${report.title}. ${report.category.name}. ${STATUS[report.status].short}${kind === 'critico' ? '. Gravedad crítica' : ''}`
  const className = `gs-pin gs-pin--${kind}${selected ? ' gs-pin--selected' : ''}`
  const body = (
    <>
      <PinShape kind={kind} selected={selected} />
      <span className="gs-pin__glyph" style={{ color: outline ? color : '#fff' }}>
        <Glyph />
      </span>
    </>
  )
  if (!interactive) {
    return <span className={className} style={{ '--pin-color': color } as CSSProperties} role="img" aria-label={label}>{body}</span>
  }
  return (
    <button type="button" className={className} style={{ '--pin-color': color } as CSSProperties} aria-label={label} aria-pressed={selected} title={report.title}>
      {body}
    </button>
  )
}

export type ClusterCounts = Record<PinGroup, number> & { critica: number }

/**
 * Grupo de reportes cercanos: número grande al centro, anillo con la proporción de cada etapa
 * y, si incluye críticos, un rombo rojo con cuántos son. El clic lo maneja el <Marker>.
 */
export function ClusterPin({ count, counts }: { count: number; counts: ClusterCounts }) {
  const size = Math.round(Math.min(60, 38 + Math.log2(count) * 5))
  let acc = 0
  const stops = PIN_GROUP_ORDER.filter((g) => counts[g] > 0).map((g) => {
    const from = (acc / count) * 360
    acc += counts[g]
    return `${PIN_GROUPS[g].color} ${from}deg ${(acc / count) * 360}deg`
  })
  const parts = PIN_GROUP_ORDER.filter((g) => counts[g] > 0).map((g) => `${counts[g]} ${PIN_GROUPS[g].label.toLowerCase()}`)
  const label = `Grupo de ${count} reportes: ${parts.join(', ')}${counts.critica ? `, ${counts.critica} críticos` : ''}. Acercar`
  return (
    <button
      type="button"
      className="gs-cluster"
      style={{ width: size, height: size, background: `conic-gradient(${stops.join(', ')})` }}
      aria-label={label}
      title={label}
    >
      <span className="gs-cluster__count" style={{ fontSize: count >= 100 ? 13 : 15 }}>{count > 999 ? '999+' : count}</span>
      {counts.critica > 0 && (
        <span className="gs-cluster__critical" aria-hidden>
          <span>{counts.critica > 9 ? '9+' : counts.critica}</span>
        </span>
      )}
    </button>
  )
}

/** Pin simple para elegir la ubicación al crear un reporte */
export function PickerPin() {
  return (
    <div style={{ width: 36, height: 46 }} className="flex items-start justify-center">
      <div className="gs-picker">
        <span />
      </div>
    </div>
  )
}

/** Punto azul de "estás aquí" */
export function MePin() {
  return <div className="gs-me" role="img" aria-label="Tu ubicación" />
}
