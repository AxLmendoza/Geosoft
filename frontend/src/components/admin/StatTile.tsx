import type { ReactNode } from 'react'

export default function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="gs-reveal glass glass-hover group relative overflow-hidden rounded-2xl p-5 hover:-translate-y-0.5">
      <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-fern/70 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden />
      <span className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-fern/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100 lg:opacity-60" aria-hidden />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
