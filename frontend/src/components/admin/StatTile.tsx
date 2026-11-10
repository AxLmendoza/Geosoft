import type { ReactNode } from 'react'

export default function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="glass group relative overflow-hidden rounded-2xl p-5 transition duration-200 hover:shadow-lift">
      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 to-brand-300 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
