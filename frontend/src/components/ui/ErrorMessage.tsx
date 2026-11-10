import type { ReactNode } from 'react'
import { ExclamationCircleIcon } from '@heroicons/react/20/solid'

export default function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-700">
      <ExclamationCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
