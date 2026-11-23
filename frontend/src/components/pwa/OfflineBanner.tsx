import { useEffect, useState } from 'react'
import { SignalSlashIcon } from '@heroicons/react/24/outline'

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (online) return null
  return (
    <div className="fixed left-1/2 top-3 z-50 flex w-[calc(100vw-1.5rem)] md:w-[calc(100vw-8rem)] max-w-xl -translate-x-1/2 items-center justify-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-center text-[13px] font-semibold text-amber-950 shadow-lift">
      <SignalSlashIcon className="size-4 shrink-0" aria-hidden /> Sin conexión: verás los últimos datos guardados. Para publicar reportes necesitas internet.
    </div>
  )
}
