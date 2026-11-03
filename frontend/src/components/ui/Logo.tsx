export default function Logo({ dark = false, iconOnly = false }: { dark?: boolean; iconOnly?: boolean }) {
  const solid = dark || iconOnly
  return (
    <span className={`flex items-center gap-2 text-xl ${dark ? 'text-indigo-700' : 'text-white'}`}>
      <svg viewBox="0 0 64 64" className={iconOnly ? 'size-10' : 'size-8'} aria-hidden>
        <rect width="64" height="64" rx="14" fill={solid ? '#4f46e5' : 'rgba(255,255,255,.2)'} />
        <path d="M32 12c-8.3 0-15 6.5-15 14.6C17 37.5 32 52 32 52s15-14.5 15-25.4C47 18.5 40.3 12 32 12Z" fill="#fff" />
        <circle cx="32" cy="27" r="6" fill="#4f46e5" />
      </svg>
      {!iconOnly && (
        <span>
          <b className="font-extrabold">Geo</b>Script
        </span>
      )}
    </span>
  )
}
