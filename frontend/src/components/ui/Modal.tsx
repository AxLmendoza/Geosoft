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

export default function Modal({ open, onClose, title, children, size = 'md' }: Props) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[1200]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <DialogPanel
          transition
          className={`w-full ${size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92dvh] overflow-y-auto glass-strong rounded-t-2xl p-5 transition duration-200 data-[closed]:translate-y-8 data-[closed]:opacity-0 sm:rounded-2xl`}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <DialogTitle className="text-lg font-bold text-slate-900">{title}</DialogTitle>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/60 hover:text-slate-600" aria-label="Cerrar">
              <XMarkIcon className="size-6" />
            </button>
          </div>
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
