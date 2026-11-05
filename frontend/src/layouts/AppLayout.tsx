import { useState, type ComponentType, type SVGProps } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { Bars3Icon, CameraIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { ROLE } from '@/lib/labels'
import { navFor, reportsFirst, type NavGroup, type NavLinkItem } from '@/lib/navigation'
import Logo from '@/components/ui/Logo'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import OfflineBanner from '@/components/pwa/OfflineBanner'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

/* ----------------------------- Escritorio ----------------------------- */

function SideLink({ item }: { item: NavLinkItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      <item.icon className="size-5 shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  )
}

function NavGroups({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  return (
    <div className="space-y-5" onClick={onNavigate}>
      {groups.map((g, i) => (
        <div key={g.title ?? i}>
          {g.title && <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.title}</p>}
          <div className="space-y-0.5">
            {g.items.map((item) => <SideLink key={item.to} item={item} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------- Celular ------------------------------- */

function TabLink({ to, label, icon: Icon, end, highlight }: { to: string; label: string; icon: Icon; end?: boolean; highlight?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-semibold transition ${
          highlight ? 'bg-indigo-600 text-white' : isActive ? 'text-indigo-700' : 'text-slate-500'
        }`
      }
    >
      <Icon className="size-6" aria-hidden />
      <span className="max-w-full truncate px-1">{label}</span>
    </NavLink>
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
    <div className="space-y-2">
      <div className="px-3">
        <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
        <p className="truncate text-xs text-slate-500">{ROLE[user.role]} · {user.email}</p>
      </div>
      <button onClick={doLogout} className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-red-700">
        Cerrar sesión
      </button>
    </div>
  ) : (
    <div className="space-y-2 px-1">
      <Link to="/auth/login" onClick={() => setMenuOpen(false)} className="btn-primary w-full">Iniciar sesión</Link>
      <Link to="/auth/register" onClick={() => setMenuOpen(false)} className="btn-secondary w-full">Crear cuenta</Link>
    </div>
  )

  return (
    <div className="min-h-dvh">
      {/* ---------- Escritorio / tablet: barra lateral con etiquetas ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-200 bg-white md:flex" aria-label="Navegación principal">
        <Link to="/" className="flex items-center px-5 py-5" aria-label="GeoScript, inicio">
          <Logo dark />
        </Link>
        {citizen && (
          <div className="px-3 pb-4">
            <Link to="/reports/new" className="btn-primary w-full">
              <CameraIcon className="size-5" aria-hidden /> Nuevo reporte
            </Link>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto px-3">
          <NavGroups groups={groups} />
        </nav>
        <div className="border-t border-slate-200 p-3">{account}</div>
      </aside>

      {/* ---------- Celular: barra inferior con etiquetas ---------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-slate-200 bg-white px-2 pt-1.5 md:hidden"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        aria-label="Navegación principal"
      >
        {primary.slice(0, 1).map((i) => <TabLink key={i.to} to={i.to} end={i.end} icon={i.icon} label={short(i.to) ?? i.label} />)}
        {citizen && <TabLink to="/reports/new" icon={CameraIcon} label="Reportar" highlight={pathname === '/reports/new'} />}
        {primary.slice(1).map((i) => <TabLink key={i.to} to={i.to} end={i.end} icon={i.icon} label={short(i.to) ?? i.label} />)}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-semibold text-slate-500"
          aria-haspopup="dialog"
        >
          <Bars3Icon className="size-6" aria-hidden />
          {user ? 'Menú' : 'Entrar'}
        </button>
      </nav>

      {/* Menú completo del celular (hoja inferior) */}
      <Dialog open={menuOpen} onClose={setMenuOpen} className="relative z-[1300] md:hidden">
        <DialogBackdrop transition className="fixed inset-0 bg-slate-900/40 transition-opacity data-[closed]:opacity-0" />
        <div className="fixed inset-x-0 bottom-0">
          <DialogPanel
            transition
            className="max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white p-4 transition duration-200 data-[closed]:translate-y-full"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-slate-900">Menú</DialogTitle>
              <button onClick={() => setMenuOpen(false)} className="btn-secondary btn-compact">
                <XMarkIcon className="size-4" aria-hidden /> Cerrar
              </button>
            </div>
            <NavGroups groups={groups} onNavigate={() => setMenuOpen(false)} />
            <div className="mt-5 border-t border-slate-200 pt-4">{account}</div>
          </DialogPanel>
        </div>
      </Dialog>

      <OfflineBanner />
      <InstallPrompt />

      {isHome ? (
        // El inicio es el mapa; en el celular termina donde empieza la barra inferior
        <main className="fixed inset-x-0 top-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:bottom-0 md:left-60">
          <Outlet />
        </main>
      ) : (
        <main className="px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:py-8 md:pl-[17rem] md:pr-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      )}
    </div>
  )
}
