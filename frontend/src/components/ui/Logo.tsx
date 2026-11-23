import { useId } from 'react'

/** El id del degradado es único por instancia: si una copia está oculta (display:none), las demás siguen pintándose */
export default function Logo({ dark = false, iconOnly = false }: { dark?: boolean; iconOnly?: boolean }) {
  const solid = dark || iconOnly
  const gradient = `gs-logo-bg-${useId().replace(/:/g, "")}`
  return (
    <span className={`flex items-center gap-2.5 font-display text-xl tracking-[-0.02em] ${dark ? 'text-slate-900' : 'text-white'}`}>
      <svg viewBox="0 0 64 64" className={iconOnly ? 'size-10' : 'size-9'} aria-hidden>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b72f6" />
            <stop offset="1" stopColor="#1d43d8" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill={solid ? `url(#${gradient})` : 'rgba(255,255,255,.16)'} />
        {/* anillos de "radar" alrededor del pin */}
        <ellipse cx="32" cy="49" rx="13" ry="3.5" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2" />
        <path d="M32 11c-8.3 0-15 6.5-15 14.6C17 36.5 32 50 32 50s15-13.5 15-24.4C47 17.5 40.3 11 32 11Z" fill="#fff" />
        <circle cx="32" cy="26" r="6" fill={solid ? '#1d43d8' : '#1e348a'} />
        <circle cx="32" cy="26" r="2.4" fill="#34d399" />
      </svg>
      {!iconOnly && (
        <span className="leading-none">
          <b className="font-bold">Geo</b>
          <span className={`font-medium ${dark ? 'text-brand-700' : 'text-white/85'}`}>Script</span>
        </span>
      )}
    </span>
  )
}
