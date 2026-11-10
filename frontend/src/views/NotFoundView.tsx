import { Link } from 'react-router-dom'
import { MapIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { FadeIn } from '@/components/ui/Motion'

export default function NotFoundView() {
  return (
    <FadeIn className="flex flex-col items-center py-20 text-center sm:py-28">
      <span className="relative mb-6 flex size-20 items-center justify-center rounded-3xl bg-brand-50 text-brand-600 ring-8 ring-brand-50/60">
        <MapPinIcon className="size-10" aria-hidden />
      </span>
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-slate-900 sm:text-4xl">Esta página no está en el mapa</h1>
      <p className="mt-3 max-w-md text-slate-500">Es posible que el enlace esté incompleto o que la página se haya movido.</p>
      <Link to="/" className="btn-primary mt-8">
        <MapIcon className="size-5" aria-hidden /> Ir al mapa
      </Link>
    </FadeIn>
  )
}
