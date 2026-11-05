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
    <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 z-[1400] mx-auto max-w-sm rounded-2xl border border-white/10 bg-slate-900/75 p-4 text-white shadow-2xl backdrop-blur-xl" role="alert">
      <div className="flex items-start gap-3">
        {needRefresh ? <ArrowPathIcon className="size-6 shrink-0 text-indigo-300" /> : <CheckCircleIcon className="size-6 shrink-0 text-emerald-400" />}
        <p className="flex-1 text-sm">
          {needRefresh ? 'Hay una nueva versión de GeoScript disponible.' : 'GeoScript está lista para usarse sin conexión.'}
        </p>
        <button onClick={close} aria-label="Cerrar" className="text-slate-400 hover:text-white">
          <XMarkIcon className="size-5" />
        </button>
      </div>
      {needRefresh && (
        <button onClick={() => updateServiceWorker(true)} className="mt-3 w-full rounded-xl bg-indigo-500 py-2 text-sm font-bold hover:bg-indigo-400">
          Actualizar ahora
        </button>
      )}
    </div>
  )
}
