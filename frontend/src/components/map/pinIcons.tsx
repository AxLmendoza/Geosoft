import { CheckCircleIcon, ExclamationTriangleIcon, ShieldExclamationIcon } from '@heroicons/react/24/solid'
import type { Report } from '@/types'

type PinKind = 'advertencia' | 'critica' | 'resuelto'

const PIN_KINDS = {
  advertencia: { Icon: ExclamationTriangleIcon, color: 'text-amber-500', label: 'Advertencia' },
  critica: { Icon: ShieldExclamationIcon, color: 'text-red-600', label: 'Alerta crítica' },
  resuelto: { Icon: CheckCircleIcon, color: 'text-emerald-600', label: 'Resuelto' },
} satisfies Record<PinKind, unknown>

/** Resuelto · gravedad crítica · cualquier otro reporte abierto (advertencia) */
export function pinKind(report: Pick<Report, 'status' | 'severity'>): PinKind {
  if (report.status === 'resuelto') return 'resuelto'
  if (report.severity === 'critica') return 'critica'
  return 'advertencia'
}

/** Icono de estado del reporte, el mismo que se ve dentro del pin */
export function PinStatusIcon({ kind, className = 'size-7' }: { kind: PinKind; className?: string }) {
  const { Icon, color } = PIN_KINDS[kind]
  return <Icon className={`${className} ${color}`} aria-hidden />
}

export const PIN_LEGEND = (Object.keys(PIN_KINDS) as PinKind[]).map((kind) => ({ kind, label: PIN_KINDS[kind].label }))

/**
 * Pin con un icono según el estado del reporte (ya no usa la foto subida).
 * El borde toma el color de la categoría y los reportes críticos "laten".
 */
export function ReportPin({ report }: { report: Report }) {
  const color = report.category?.color ?? '#4f46e5'
  const critical = report.severity === 'critica' && report.status !== 'resuelto' ? ' gs-pin--critical' : ''
  const resolved = report.status === 'resuelto' ? ' gs-pin--resolved' : ''
  return (
    <div className="gs-pin-wrapper" style={{ width: 56, height: 68 }} title={report.title}>
      <div className={`gs-pin${critical}${resolved}`} style={{ '--pin-color': color } as React.CSSProperties}>
        <PinStatusIcon kind={pinKind(report)} />
      </div>
    </div>
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
  return <div className="gs-me" />
}
