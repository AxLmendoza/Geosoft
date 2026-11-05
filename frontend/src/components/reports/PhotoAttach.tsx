import { useEffect, useMemo, useRef, useState } from 'react'
import { CameraIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { compressImage } from '@/lib/media'

const MAX_MB = 8

/** Selector compacto de una foto opcional (evidencias / información adicional) */
export default function PhotoAttach({ value, onChange, label = 'Adjuntar foto (opcional)' }: { value: File | null; onChange: (f: File | null) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const preview = useMemo(() => (value ? URL.createObjectURL(value) : null), [value])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const pick = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('El archivo debe ser una imagen')
    setBusy(true)
    const small = await compressImage(file)
    setBusy(false)
    if (small.size > MAX_MB * 1024 * 1024) return setError(`La imagen supera ${MAX_MB} MB`)
    setError(null)
    onChange(small)
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      {value && preview ? (
        <div className="relative inline-block">
          <img src={preview} alt="Foto adjunta" className="size-24 rounded-xl object-cover ring-1 ring-slate-200" />
          <button type="button" onClick={() => onChange(null)} className="absolute -right-2 -top-2 rounded-full bg-slate-900 p-1 text-white" aria-label="Quitar foto">
            <XMarkIcon className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
        >
          <CameraIcon className="size-5" /> {busy ? 'Preparando foto…' : label}
        </button>
      )}
      {error && <p className="mt-1 text-sm font-medium text-red-600">{error}</p>}
    </div>
  )
}
