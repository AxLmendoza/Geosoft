import { Link, Outlet, useLocation } from 'react-router-dom'
import { BellAlertIcon, CameraIcon, MapPinIcon } from '@heroicons/react/24/outline'
import Logo from '@/components/ui/Logo'
import { FadeIn, PageTransition, Stagger, StaggerItem } from '@/components/ui/Motion'

const STEPS = [
  { icon: CameraIcon, title: 'Toma una foto', text: 'Bache, fuga, luminaria o basura: muestra el problema.' },
  { icon: MapPinIcon, title: 'Marca el lugar', text: 'Tu ubicación se agrega en el mapa de forma automática.' },
  { icon: BellAlertIcon, title: 'Da seguimiento', text: 'Ve cómo avanza hasta que el área responsable lo resuelve.' },
]

export default function AuthLayout() {
  const { pathname } = useLocation()
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Panel de marca (solo pantallas grandes) */}
      <aside className="gs-brand-panel relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="gs-grid-pattern pointer-events-none absolute inset-0" aria-hidden />
        <Link to="/" className="relative w-fit" aria-label="GeoScript, inicio">
          <Logo />
        </Link>

        <div className="relative max-w-md">
          <FadeIn>
            <p className="text-[15px] font-medium text-cream/80">Reportes ciudadanos</p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight xl:text-[2.75rem]">
              Tu ciudad mejora cuando la reportas.
            </h2>
            <p className="mt-4 text-lg text-cream/90">
              Reporta fallas de servicios públicos y sigue su atención en tiempo real, de principio a fin.
            </p>
          </FadeIn>

          <Stagger className="mt-10 space-y-3">
            {STEPS.map((s) => (
              <StaggerItem key={s.title} className="flex items-start gap-4 rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm transition-colors duration-300 hover:bg-white/[0.13]">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/20">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-cream/80">{s.text}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <p className="relative text-sm text-cream/65">© {new Date().getFullYear()} GeoScript · Servicios públicos</p>
      </aside>

      {/* Formulario */}
      <main className="gs-aurora flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <Link to="/" className="mb-8 lg:hidden" aria-label="GeoScript, inicio">
          <Logo dark />
        </Link>
        <PageTransition key={pathname} className="w-full max-w-md">
          <div className="glass-strong rounded-3xl p-6 sm:p-9">
            <Outlet />
          </div>
        </PageTransition>
        <Link to="/" className="btn-link mt-6 text-slate-500">Ver el mapa sin iniciar sesión</Link>
      </main>
    </div>
  )
}
