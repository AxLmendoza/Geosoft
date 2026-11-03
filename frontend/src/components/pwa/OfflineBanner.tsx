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
    <div className="fixed left-1/2 top-3 z-50 flex w-[calc(100vw-6rem)] max-w-xl -translate-x-1/2 items-center justify-center gap-2 rounded-2xl border border-amber-200/60 bg-amber-400/70 px-3 py-1.5 text-center text-sm font-semibold text-amber-950 shadow-lg backdrop-blur-md">
      <SignalSlashIcon className="size-4" /> Sin conexión: verás los últimos datos guardados. Para publicar reportes necesitas internet.
    </div>
  )
}
