import { useRegisterSW } from 'virtual:pwa-register/react'
import { ArrowPathIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'

/**
 * Registra el service worker y avisa:
 * - "Lista para usarse sin conexión" la primera vez
 * - "Nueva versión disponible" cuando se despliega una actualización
 */
export default function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Busca actualizaciones cada hora mientras la app esté abierta
      if (registration) setInterval(() => registration.update(), 60 * 60 * 1000)
    },
  })

  if (!offlineReady && !needRefresh) return null

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className="glass-strong animate-rise fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[1400] mx-auto max-w-sm rounded-2xl p-4 text-slate-800 lg:inset-x-auto lg:bottom-6 lg:right-6" role="status">
      <div className="flex items-start gap-3">
        {needRefresh ? <ArrowPathIcon className="size-6 shrink-0 text-brand-600" aria-hidden /> : <CheckCircleIcon className="size-6 shrink-0 text-emerald-600" aria-hidden />}
        <p className="flex-1 pt-0.5 text-sm font-medium">
          {needRefresh ? 'Hay una nueva versión de GeoScript disponible.' : 'GeoScript está lista para usarse sin conexión.'}
        </p>
        <button onClick={close} aria-label="Cerrar aviso" className="-m-2 flex size-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
          <XMarkIcon className="size-5" aria-hidden />
        </button>
      </div>
      {needRefresh && (
        <button onClick={() => updateServiceWorker(true)} className="btn-primary mt-3 w-full">
          Actualizar ahora
        </button>
      )}
    </div>
  )
}
