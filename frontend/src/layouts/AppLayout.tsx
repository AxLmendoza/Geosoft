import { useEffect, useState, type ComponentType, type SVGProps } from 'react'
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
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sage to-olive font-display font-semibold text-cream ring-2 ring-white/70 ${className}`}
    >
      {initials(name)}
    </span>
  )
}

/**
 * En el celular, mientras se escribe en un campo el teclado ocupa media pantalla:
 * la barra inferior se oculta para no tapar el formulario ni el botón de enviar.
 */
function useTyping() {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]), textarea, select') || el.isContentEditable)
    const onIn = (e: FocusEvent) => setTyping(isField(e.target) && window.matchMedia('(max-width: 1023px)').matches)
    const onOut = () => setTyping(false)
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
    }
  }, [])
  return typing
}

/* ----------------------------- Escritorio ----------------------------- */

function SideLink({ item, layoutGroup }: { item: NavLinkItem; layoutGroup: string }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-medium transition-colors duration-200 ${
          isActive ? 'text-slate-950' : 'text-slate-500 hover:bg-slate-950/[0.05] hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <m.span
              layoutId={`nav-active-${layoutGroup}`}
              transition={SPRING}
              className="absolute inset-0 rounded-xl bg-gradient-to-r from-slate-950/[0.1] to-slate-950/[0.04] ring-1 ring-line-strong before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-fern before:shadow-[0_0_12px_rgb(163_188_151/0.9)]"
              aria-hidden
            />
          )}
          <item.icon className={`relative size-5 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 ${isActive ? 'text-fern' : 'text-slate-400 group-hover:text-slate-700'}`} aria-hidden />
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
          {g.title && <p className="mb-1.5 px-3 text-[13px] font-medium text-slate-500">{g.title}</p>}
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
        `relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-semibold transition-colors ${
          isActive ? 'text-brand-800' : 'text-slate-500 active:text-slate-800'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <m.span layoutId="tab-active" transition={SPRING} className="absolute top-1 h-8 w-14 rounded-full bg-fern/[0.14] ring-1 ring-fern/25" aria-hidden />
          )}
          <Icon className={`relative size-6 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isActive ? 'scale-105' : ''}`} aria-hidden />
          <span className="relative max-w-full truncate px-1">{label}</span>
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
        className={`-mt-5 flex size-14 items-center justify-center rounded-full text-cream shadow-brand ring-4 ring-white/90 transition-colors ${active ? 'bg-olive-bright' : 'bg-olive'}`}
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
  '/admin/staff': 'Equipo',
}

export default function AppLayout() {
  const { user } = useAuth()
  const logout = useLogout()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const typing = useTyping()
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
      <aside className="gs-sidebar gs-dark fixed inset-y-3 left-3 z-40 hidden w-[15.25rem] flex-col overflow-hidden rounded-[1.75rem] lg:flex" aria-label="Navegación principal">
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
        <div className="border-t border-line bg-night/15 p-3">{account}</div>
      </aside>

      {/* ---------- Celular: encabezado compacto fuera del mapa ---------- */}
      {!isHome && (
        <header
          className="material sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 shadow-none! border-b border-line lg:hidden"
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
        className={`material fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t border-line px-2 pt-1 sm:px-[calc(50vw-17rem)] transition-transform duration-200 lg:hidden ${typing ? 'translate-y-full' : ''}`}
        // Altura fija = la misma que libra el mapa (bottom de <main>): sin rendijas con ningún rol
        style={{ height: 'calc(4.25rem + env(safe-area-inset-bottom))', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        aria-label="Navegación principal"
      >
        {primary.slice(0, 1).map((i) => <TabLink key={i.to} to={i.to} end={i.end} icon={i.icon} label={short(i.to) ?? i.label} />)}
        {citizen && <ReportTab active={pathname === '/reports/new'} />}
        {primary.slice(1).map((i) => <TabLink key={i.to} to={i.to} end={i.end} icon={i.icon} label={short(i.to) ?? i.label} />)}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-semibold text-slate-500 active:text-slate-800"
          aria-haspopup="dialog"
        >
          <Bars3Icon className="size-6" aria-hidden />
          {user ? 'Menú' : 'Entrar'}
        </button>
      </nav>

      {/* Menú completo del celular (hoja inferior) */}
      <Dialog open={menuOpen} onClose={setMenuOpen} className="relative z-[1300] lg:hidden">
        <DialogBackdrop transition className="fixed inset-0 bg-night/35 backdrop-blur-sm transition-opacity duration-200 data-[closed]:opacity-0" />
        <div className="fixed inset-x-0 bottom-0">
          <DialogPanel
            transition
            className="max-h-[85dvh] overflow-y-auto rounded-t-3xl glass-strong border-b-0 px-4 pb-4 pt-2 transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[closed]:translate-y-full data-[leave]:duration-200"
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
        <main id="main" className="fixed inset-x-0 top-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] lg:top-3 lg:right-3 lg:bottom-3 lg:left-[16.75rem] lg:overflow-hidden lg:rounded-[1.75rem] lg:shadow-pop lg:ring-1 lg:ring-line-strong">
          <Outlet />
        </main>
      ) : (
        <main id="main" className="px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 lg:py-10 lg:pl-[18.5rem] lg:pr-10">
          <PageTransition key={pathname} className="mx-auto max-w-6xl">
            <Outlet />
          </PageTransition>
        </main>
      )}
    </div>
  )
}
