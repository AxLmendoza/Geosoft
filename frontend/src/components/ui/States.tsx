import type { CSSProperties, ReactNode } from 'react'
import { ArrowPathIcon, ExclamationTriangleIcon, InboxIcon } from '@heroicons/react/24/outline'

/** Bloque gris animado que ocupa el lugar del contenido mientras carga */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden style={style} className={`animate-pulse rounded-xl bg-slate-900/[0.07] ${className}`} />
}

/** Tarjeta de reporte "fantasma" con la misma forma que ReportCard */
export function ReportCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl glass" aria-hidden>
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

/** Filas fantasma para listas y tablas */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-white/50 overflow-hidden rounded-2xl glass" role="status" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="size-14 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Mensaje cuando no hay datos */
export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl glass px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">{icon ?? <InboxIcon className="size-6" />}</span>
      <p className="font-bold text-slate-800">{title}</p>
      {text && <p className="max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Error de carga con botón para reintentar */
export function ErrorState({ message = 'No pudimos cargar la información.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl bg-red-50/80 px-6 py-10 text-center ring-1 ring-red-200">
      <ExclamationTriangleIcon className="size-8 text-red-500" />
      <p className="font-bold text-red-800">{message}</p>
      <p className="text-sm text-red-700/80">Revisa tu conexión e inténtalo de nuevo.</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-50">
          <ArrowPathIcon className="size-4" /> Reintentar
        </button>
      )}
    </div>
  )
}

/** Indicador pequeño de "actualizando" cuando ya hay datos en pantalla */
export function RefreshingBadge({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
      <ArrowPathIcon className="size-3.5 animate-spin" /> Actualizando…
    </span>
  )
}
