import type { ReactNode } from 'react'

export default function ErrorMessage({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-sm font-medium text-red-600">{children}</p>
}
