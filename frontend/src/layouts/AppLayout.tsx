import { useState, type ComponentType, type SVGProps } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { ArrowRightStartOnRectangleIcon, Bars3Icon, CameraIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { ROLE } from '@/lib/labels'
import { navFor, reportsFirst, type NavGroup, type NavLinkItem } from '@/lib/navigation'
import Logo from '@/components/ui/Logo'
import { m, PageTransition, SPRING } from '@/components/ui/Motion'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import OfflineBanner from '@/components/pwa/OfflineBanner'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

/** Iniciales para el avatar del usuario */
const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'

function Avatar({ name, className = 'size-9 text-sm' }: { name?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-display font-semibold text-white ring-2 ring-white ${className}`}
    >
      {initials(name)}
    </span>
  )
}

/* ----------------------------- Escritorio ----------------------------- */

function SideLink({ item, layoutGroup }: { item: NavLinkItem; layoutGroup: string }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-medium transition-colors duration-150 ${
          isActive ? 'text-brand-800' : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <m.span
              layoutId={`nav-active-${layoutGroup}`}
              transition={SPRING}
              className="absolute inset-0 rounded-xl bg-brand-50 ring-1 ring-inset ring-brand-100"
              aria-hidden
            />
          )}
          {isActive && (
            <m.span
              layoutId={`nav-bar-${layoutGroup}`}
              transition={SPRING}
              className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-600"
              aria-hidden
            />
          )}
          <item.icon className={`relative size-5 shrink-0 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} aria-hidden />
          <span className="relative truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

function NavGroups({ groups, onNavigate, layoutGroup }: { groups: NavGroup[]; onNavigate?: () => void; layoutGroup: string }) {
  return (
    <div className="space-y-6" onClick={onNavigate}>
      {groups.map((g, i) => (
        <div key={g.title ?? i}>
          {g.title && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{g.title}</p>}
          <div className="space-y-0.5">
            {g.items.map((item) => <SideLink key={item.to} item={item} layoutGroup={layoutGroup} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------- Celular ------------------------------- */

function TabLink({ to, label, icon: Icon, end }: { to: string; label: string; icon: Icon; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition-colors ${
          isActive ? 'text-brand-700' : 'text-slate-500 active:text-slate-700'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <m.span layoutId="tab-active" transition={SPRING} className="absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-brand-600" aria-hidden />
          )}
          <Icon className="size-6" aria-hidden />
          <span className="max-w-full truncate px-1">{label}</span>
        </>
      )}
    </NavLink>
  )
}

/** Botón central destacado para crear un reporte */
function ReportTab({ active }: { active: boolean }) {
  return (
    <Link to="/reports/new" className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5 pb-1.5 text-[11px] font-semibold text-brand-700" aria-current={active ? 'page' : undefined}>
      <m.span
        whileTap={{ scale: 0.92 }}
        className={`-mt-6 flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-brand ring-4 ring-canvas ${active ? 'bg-brand-700' : ''}`}
      >
        <CameraIcon className="size-7" aria-hidden />
      </m.span>
      Reportar
    </Link>
  )
}

/** Etiquetas cortas para la barra inferior (el menú muestra los nombres completos) */
const SHORT: Record<string, string> = {
  '/': 'Mapa',
  '/admin': 'Resumen',
  '/attention': 'Bandeja',
  '/reports/mine': 'Mis reportes',
  '/moderation': 'Moderación',
}

export default function AppLayout() {
  const { user } = useAuth()
  const logout = useLogout()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const isHome = pathname === '/'
  const groups = navFor(user?.role)
  const citizen = reportsFirst(user?.role)

  // Barra inferior: las 2–3 secciones principales del rol + "Menú" con todo lo demás
  const primary = groups.flatMap((g) => g.items).slice(0, citizen ? 2 : 3)
  const short = (to: string) => (to === '/attention' && user?.role === 'operativo' ? 'Mi área' : SHORT[to])

  const doLogout = () => {
    setMenuOpen(false)
    logout()
    navigate('/')
  }

  const account = user ? (
    <div className="space-y-1">
      <div className="flex items-center gap-3 rounded-xl p-2">
        <Avatar name={user.name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{ROLE[user.role]} · {user.email}</p>
        </div>
      </div>
      <button
        onClick={doLogout}
        className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <ArrowRightStartOnRectangleIcon className="size-5" aria-hidden /> Cerrar sesión
      </button>
    </div>
  ) : (
    <div className="space-y-2 px-1">
      <p className="px-1 pb-1 text-xs text-slate-500">Inicia sesión para reportar y dar seguimiento.</p>
      <Link to="/auth/login" onClick={() => setMenuOpen(false)} className="btn-primary w-full">Iniciar sesión</Link>
      <Link to="/auth/register" onClick={() => setMenuOpen(false)} className="btn-secondary w-full">Crear cuenta</Link>
    </div>
  )

  return (
    <div className="min-h-dvh">
      {/* Enlace para saltar al contenido (teclado / lector de pantalla) */}
      <a href="#main" className="sr-only z-[1500] rounded-lg bg-white px-4 py-2 font-semibold text-brand-700 shadow-lift focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Saltar al contenido
      </a>

      {/* ---------- Escritorio / tablet: barra lateral con etiquetas ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-white/95 backdrop-blur md:flex" aria-label="Navegación principal">
        <Link to="/" className="flex items-center px-5 pb-4 pt-6" aria-label="GeoScript, inicio">
          <Logo dark />
        </Link>
        {citizen && (
          <div className="px-4 pb-5">
            <Link to="/reports/new" className="btn-primary w-full">
              <CameraIcon className="size-5" aria-hidden /> Nuevo reporte
            </Link>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto px-4 pb-4">
          <NavGroups groups={groups} layoutGroup="side" />
        </nav>
        <div className="border-t border-line p-3">{account}</div>
      </aside>

      {/* ---------- Celular: encabezado compacto fuera del mapa ---------- */}
      {!isHome && (
        <header
          className="sticky top-0 z-30 flex items-center justify-between border-b border-line/80 bg-canvas/85 px-4 py-2.5 backdrop-blur-lg md:hidden"
          style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
        >
          <Link to="/" aria-label="GeoScript, inicio"><Logo dark /></Link>
          {user && (
            <button onClick={() => setMenuOpen(true)} className="rounded-full" aria-label="Abrir menú de la cuenta" aria-haspopup="dialog">
              <Avatar name={user.name} className="size-9 text-sm" />
            </button>
          )}
        </header>
      )}

      {/* ---------- Celular: barra inferior con etiquetas ---------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t border-line bg-white/90 px-2 pt-1 shadow-[0_-8px_24px_-12px_rgb(15_23_42/0.18)] backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        aria-label="Navegación principal"
      >
        {primary.slice(0, 1).map((i) => <TabLink key={i.to} to={i.to} end={i.end} icon={i.icon} label={short(i.to) ?? i.label} />)}
        {citizen && <ReportTab active={pathname === '/reports/new'} />}
        {primary.slice(1).map((i) => <TabLink key={i.to} to={i.to} end={i.end} icon={i.icon} label={short(i.to) ?? i.label} />)}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold text-slate-500 active:text-slate-700"
          aria-haspopup="dialog"
        >
          <Bars3Icon className="size-6" aria-hidden />
          {user ? 'Menú' : 'Entrar'}
        </button>
      </nav>

      {/* Menú completo del celular (hoja inferior) */}
      <Dialog open={menuOpen} onClose={setMenuOpen} className="relative z-[1300] md:hidden">
        <DialogBackdrop transition className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-200 data-[closed]:opacity-0" />
        <div className="fixed inset-x-0 bottom-0">
          <DialogPanel
            transition
            className="max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-4 pt-2 shadow-pop transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[closed]:translate-y-full data-[leave]:duration-200"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden />
            <div className="mb-4 flex items-center justify-between">
              <DialogTitle className="font-display text-lg font-semibold text-slate-900">Menú</DialogTitle>
              <button onClick={() => setMenuOpen(false)} className="btn-secondary btn-compact">
                <XMarkIcon className="size-4" aria-hidden /> Cerrar
              </button>
            </div>
            <NavGroups groups={groups} onNavigate={() => setMenuOpen(false)} layoutGroup="sheet" />
            <div className="mt-5 border-t border-line pt-3">{account}</div>
          </DialogPanel>
        </div>
      </Dialog>

      <OfflineBanner />
      <InstallPrompt />

      {isHome ? (
        // El inicio es el mapa; en el celular termina donde empieza la barra inferior
        <main id="main" className="fixed inset-x-0 top-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:bottom-0 md:left-64">
          <Outlet />
        </main>
      ) : (
        <main id="main" className="px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 md:py-10 md:pl-[18.5rem] md:pr-10">
          <PageTransition key={pathname} className="mx-auto max-w-6xl">
            <Outlet />
          </PageTransition>
        </main>
      )}
    </div>
  )
}
