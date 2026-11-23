import { useEffect, useState } from 'react'
import { ArrowDownTrayIcon, ArrowUpOnSquareIcon, XMarkIcon } from '@heroicons/react/24/outline'

/** Evento no estándar de Chrome/Edge/Android para instalar la PWA */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'geoscript-install-dismissed'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

function wasDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return !!at && Date.now() - at < 7 * 864e5 // no volver a molestar en 7 días
  } catch {
    return false
  }
}

/**
 * - Android / Chrome / Edge (PC): botón "Instalar app" con el prompt nativo.
 * - iPhone / iPad: Safari no tiene prompt, se muestran las instrucciones.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOS, setShowIOS] = useState(false)
  const [hidden, setHidden] = useState(() => isStandalone() || wasDismissed())

  useEffect(() => {
    if (hidden) return
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setHidden(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    if (isIOS()) setShowIOS(true)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [hidden])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* modo privado */
    }
    setHidden(true)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    if (outcome === 'accepted') setHidden(true)
  }

  if (hidden || (!deferred && !showIOS)) return null

  return (
    <div className="gs-install glass-strong fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 flex items-center gap-3 rounded-2xl p-3 lg:inset-x-auto lg:bottom-3 lg:right-3 lg:w-[calc(100vw-7rem)] lg:max-w-sm">
      <img src="/icons/pwa-192x192.png" alt="" className="size-11 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold text-slate-900">Instala GeoScript</p>
        {deferred ? (
          <p className="text-slate-600">Acceso directo, pantalla completa y uso sin conexión.</p>
        ) : (
          <p className="text-slate-600">
            Toca <ArrowUpOnSquareIcon className="inline size-4 align-text-bottom" /> <b>Compartir</b> y luego <b>Agregar a inicio</b>.
          </p>
        )}
      </div>
      {deferred && (
        <button onClick={install} className="btn-primary btn-compact shrink-0">
          <ArrowDownTrayIcon className="size-4" aria-hidden /> Instalar
        </button>
      )}
      <button onClick={dismiss} aria-label="Cerrar aviso de instalación" className="-m-1 flex size-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
        <XMarkIcon className="size-5" aria-hidden />
      </button>
    </div>
  )
}
