import { useState } from 'react'
import { Dialog, DialogPanel } from '@headlessui/react'
import { ArrowsPointingOutIcon, XMarkIcon } from '@heroicons/react/24/outline'

type Props = { src: string; alt: string; className?: string; thumbClassName?: string; thumbSrc?: string }

/**
 * Imagen que se abre a pantalla completa al tocarla.
 * En el celular se puede hacer zoom con los dedos (touch-action: pinch-zoom).
 */
export default function ImageViewer({ src, alt, className = '', thumbClassName = '', thumbSrc }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`group relative block overflow-hidden ${className}`} aria-label={`Ampliar imagen: ${alt}`}>
        <img src={thumbSrc ?? src} alt={alt} loading="lazy" decoding="async" className={thumbClassName} />
        <span className="absolute bottom-2 right-2 rounded-full bg-slate-900/60 p-1.5 text-white opacity-80 transition group-hover:opacity-100">
          <ArrowsPointingOutIcon className="size-4" />
        </span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-[1400]">
        <div className="fixed inset-0 bg-slate-950/90" aria-hidden />
        <DialogPanel className="fixed inset-0 flex items-center justify-center p-2 sm:p-8" onClick={() => setOpen(false)}>
          <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" style={{ touchAction: 'pinch-zoom' }} />
          <button
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 rounded-full bg-white/15 p-2 text-white backdrop-blur hover:bg-white/25"
            style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
            aria-label="Cerrar"
          >
            <XMarkIcon className="size-6" />
          </button>
        </DialogPanel>
      </Dialog>
    </>
  )
}
