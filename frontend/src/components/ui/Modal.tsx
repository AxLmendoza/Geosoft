import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'md' | 'lg'
}

/**
 * Modal accesible: hoja inferior en el celular y diálogo centrado en pantallas grandes.
 * Entra con desplazamiento + opacidad y sale más rápido de lo que entra.
 */
export default function Modal({ open, onClose, title, children, size = 'md' }: Props) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[1200]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-slate-900/45 backdrop-blur-[3px] transition-opacity duration-200 data-[closed]:opacity-0 data-[leave]:duration-150"
      />
      <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <DialogPanel
          transition
          className={`w-full ${size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92dvh] overflow-y-auto glass-strong rounded-t-3xl p-5 transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[closed]:translate-y-10 data-[closed]:opacity-0 data-[leave]:duration-150 sm:rounded-3xl sm:p-6 sm:data-[closed]:translate-y-3 sm:data-[closed]:scale-[0.97]`}
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden />
          <div className="mb-5 flex items-start justify-between gap-4">
            <DialogTitle className="font-display text-lg font-semibold text-slate-900">{title}</DialogTitle>
            <button
              onClick={onClose}
              className="-m-1 flex size-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Cerrar"
            >
              <XMarkIcon className="size-6" aria-hidden />
            </button>
          </div>
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
