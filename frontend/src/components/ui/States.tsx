import type { CSSProperties, ReactNode } from 'react'
import { ArrowPathIcon, ExclamationTriangleIcon, InboxIcon } from '@heroicons/react/24/outline'
import { FadeIn } from './Motion'

/** Bloque gris animado que ocupa el lugar del contenido mientras carga */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden style={style} className={`animate-pulse rounded-xl bg-slate-900/[0.06] ${className}`} />
}

/** Tarjeta de reporte "fantasma" con la misma forma que ReportCard */
export function ReportCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl glass" aria-hidden>
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/** Filas fantasma para listas y tablas */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl glass" role="status" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="size-12 shrink-0" />
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
    <FadeIn className="relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border border-line bg-surface px-6 py-14 text-center">
      <span className="relative mb-2 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-8 ring-brand-50/50">
        {icon ?? <InboxIcon className="size-7" aria-hidden />}
      </span>
      <p className="font-display text-lg font-semibold text-slate-900">{title}</p>
      {text && <p className="max-w-sm text-[15px] text-slate-500">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </FadeIn>
  )
}

/** Error de carga con botón para reintentar */
export function ErrorState({ message = 'No pudimos cargar la información.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <FadeIn role="alert" className="flex flex-col items-center gap-2 rounded-2xl bg-red-50 px-6 py-10 text-center ring-1 ring-inset ring-red-200">
      <span className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-white text-red-600 shadow-xs ring-1 ring-red-200">
        <ExclamationTriangleIcon className="size-6" aria-hidden />
      </span>
      <p className="font-display font-semibold text-red-900">{message}</p>
      <p className="text-sm text-red-800/80">Revisa tu conexión e inténtalo de nuevo.</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-danger btn-compact mt-2">
          <ArrowPathIcon className="size-4" aria-hidden /> Reintentar
        </button>
      )}
    </FadeIn>
  )
}

/** Indicador pequeño de "actualizando" cuando ya hay datos en pantalla */
export function RefreshingBadge({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 font-sans text-xs font-semibold tracking-normal text-brand-700 ring-1 ring-inset ring-brand-100">
      <ArrowPathIcon className="size-3.5 animate-spin" aria-hidden /> Actualizando…
    </span>
  )
}
