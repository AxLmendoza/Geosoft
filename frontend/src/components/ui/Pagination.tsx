/** Paginación con texto (sin botones de solo ícono) */
export default function Pagination({ page, pages, total, onChange, noun = 'reportes' }: { page: number; pages: number; total: number; onChange: (page: number) => void; noun?: string }) {
  if (pages <= 1) return null
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Paginación">
      <p className="text-slate-500">{total} {noun} · página {page} de {pages}</p>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="btn-secondary btn-compact">Anterior</button>
        <button disabled={page >= pages} onClick={() => onChange(page + 1)} className="btn-secondary btn-compact">Siguiente</button>
      </div>
    </nav>
  )
}
