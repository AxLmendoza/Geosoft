import type { ComponentType, CSSProperties, SVGProps } from 'react'
import { CheckIcon, ClockIcon, NoSymbolIcon, UserIcon, WrenchScrewdriverIcon } from '@heroicons/react/20/solid'
import { STATUS } from '@/lib/labels'
import type { Report } from '@/types'

/**
 * Simbología del mapa de GeoScript: burbuja de cristal con un núcleo de color y un solo glifo.
 *
 * - Forma: núcleo redondo = reporte · núcleo en rombo con halo = crítico abierto.
 * - Glifo: la etapa del seguimiento (reloj, persona, herramienta, palomita…).
 * - Color: refuerza la etapa con 4 tonos naturales + gris; nunca es la única pista.
 * - "Cerrado" usa la misma palomita que "Resuelto" pero en contorno (núcleo claro).
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
  critico: { label: 'Crítico', help: 'Gravedad crítica, aún sin resolver', color: '#c8402f', Glyph: Bang },
  recibido: { label: 'Recibido', help: 'Recibido o en validación', color: '#b0742a', Glyph: ClockIcon },
  asignado: { label: 'Asignado', help: 'Ya tiene un área responsable', color: '#3d6c8a', Glyph: UserIcon },
  atencion: { label: 'En atención', help: 'El personal está trabajando', color: '#3d6c8a', Glyph: WrenchScrewdriverIcon },
  resuelto: { label: 'Resuelto', help: 'Solucionado recientemente', color: '#4c6b55', Glyph: CheckIcon },
  cerrado: { label: 'Cerrado', help: 'Seguimiento terminado', color: '#4c6b55', Glyph: CheckIcon, outline: true },
  fuera: { label: 'Canalizado o no procedente', help: 'Fuera de la ruta normal', color: '#737d76', Glyph: NoSymbolIcon },
}

export const PIN_KIND_ORDER: PinKind[] = ['critico', 'recibido', 'asignado', 'atencion', 'resuelto', 'cerrado', 'fuera']

/** Etapa del reporte (4 grupos): decide si un reporte crítico sigue abierto */
export type PinGroup = 'recibido' | 'atencion' | 'resuelto' | 'otro'

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

/**
 * Cuerpo del marcador: sombra de contacto, punta y burbuja de cristal con el núcleo de color.
 * Las medidas viven en index.css (.gs-pin*): un área táctil de 44×48 px con la punta abajo al centro.
 */
function PinBody({ kind, selected }: { kind: PinKind; selected: boolean }) {
  const { Glyph } = PIN_KINDS[kind]
  return (
    <>
      <span className={`gs-pin__ground${selected ? ' gs-pin__ground--on' : ''}`} aria-hidden />
      <span className="gs-pin__tip" aria-hidden />
      <span className="gs-pin__glass" aria-hidden>
        <span className="gs-pin__core">
          <Glyph />
        </span>
      </span>
    </>
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
        background: outline ? 'rgb(255 255 255 / 0.85)' : `radial-gradient(circle at 35% 28%, color-mix(in oklab, ${color} 62%, white), ${color} 72%)`,
        boxShadow: outline
          ? `inset 0 0 0 2px ${color}, 0 0 0 2px rgb(255 255 255 / 0.7)`
          : 'inset 0 -1px 2px rgb(0 0 0 / 0.18), 0 0 0 2px rgb(255 255 255 / 0.7), 0 1px 3px rgb(30 45 36 / 0.25)',
        color: outline ? color : '#fff',
      }}
      aria-hidden
    >
      <Glyph style={{ width: size * 0.62, height: size * 0.62, transform: kind === 'critico' ? 'rotate(-45deg) scale(1.1)' : undefined }} />
    </span>
  )
}

/** El mismo marcador de cristal en tamaño pequeño y sin interacción (simbología) */
export function PinIcon({ kind, height = 30 }: { kind: PinKind; height?: number }) {
  const scale = height / 48
  return (
    <span className="relative inline-block shrink-0" style={{ width: 44 * scale, height }} aria-hidden>
      <span
        className={`gs-pin gs-pin--${kind} pointer-events-none absolute left-0 top-0`}
        style={{ '--pin-color': PIN_KINDS[kind].color, transform: `scale(${scale})`, transformOrigin: '0 0' } as CSSProperties}
      >
        <PinBody kind={kind} selected={false} />
      </span>
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
 * Marcador de reporte: área táctil de 44×48 px, burbuja de cristal + glifo + color para la etapa.
 * Rojo y rombo solo para críticos abiertos; los cerrados se ven en contorno y atenuados.
 */
export function ReportPin({ report, selected = false, interactive = false }: PinProps) {
  const kind = pinKind(report)
  const { color } = PIN_KINDS[kind]
  const label = `${report.title}. ${report.category.name}. ${STATUS[report.status].short}${kind === 'critico' ? '. Gravedad crítica' : ''}`
  const className = `gs-pin gs-pin--${kind}${selected ? ' gs-pin--selected' : ''}`
  const body = <PinBody kind={kind} selected={selected} />
  if (!interactive) {
    return <span className={className} style={{ '--pin-color': color } as CSSProperties} role="img" aria-label={label}>{body}</span>
  }
  return (
    <button type="button" className={className} style={{ '--pin-color': color } as CSSProperties} aria-label={label} aria-pressed={selected} title={report.title}>
      {body}
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

/** Punto de "estás aquí" con un pulso suave */
export function MePin() {
  return <div className="gs-me" role="img" aria-label="Tu ubicación" />
}
