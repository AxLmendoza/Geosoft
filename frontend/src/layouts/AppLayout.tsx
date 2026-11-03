import type { ComponentType, SVGProps } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
  ArrowRightEndOnRectangleIcon, ArrowRightStartOnRectangleIcon, CameraIcon, ChartBarIcon, ClockIcon, FunnelIcon, MapIcon,
  RectangleStackIcon, ShieldCheckIcon, TableCellsIcon, UserPlusIcon,
} from '@heroicons/react/24/outline'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { ROLE } from '@/lib/labels'
import Logo from '@/components/ui/Logo'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import OfflineBanner from '@/components/pwa/OfflineBanner'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

const itemClass = (active: boolean, accent = false) =>
  `group relative flex size-11 shrink-0 items-center justify-center rounded-2xl transition ${
    accent
      ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-600/40 hover:scale-105'
      : active
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
        : 'text-slate-600 hover:bg-white/70 hover:text-indigo-700'
  }`

/** Etiqueta que aparece a la derecha del icono al pasar el cursor */
function Tooltip({ label }: { label: string }) {
  return (
    <span className="glass-strong pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 opacity-0 transition group-hover:opacity-100 md:block">
      {label}
    </span>
  )
}

function RailLink({ to, label, icon: Icon, end, active, accent }: { to: string; label: string; icon: Icon; end?: boolean; active?: boolean; accent?: boolean }) {
  return (
    <NavLink to={to} end={end} aria-label={label} className={({ isActive }) => itemClass(active ?? isActive, accent)}>
      <Icon className="size-6" />
      <Tooltip label={label} />
    </NavLink>
  )
}

export default function AppLayout() {
  const { user, isStaff, isAdmin } = useAuth()
  const logout = useLogout()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const isHome = pathname === '/'
  const panel = isHome ? params.get('panel') : null

  // Los paneles del mapa viven en la URL (?panel=...) junto con los filtros activos
  const panelLink = (name: string) => {
    const next = new URLSearchParams(isHome ? params : undefined)
    if (panel === name) next.delete('panel')
    else next.set('panel', name)
    const qs = next.toString()
    return qs ? `/?${qs}` : '/'
  }

  return (
    <div className="min-h-dvh">
      {/* Barra lateral de cristal */}
      <aside className="glass fixed bottom-2 left-2 top-2 z-40 flex w-14 flex-col items-center gap-2 rounded-3xl py-3 max-md:overflow-y-auto md:bottom-3 md:left-3 md:top-3 md:w-16">
        <Link to="/" aria-label="Inicio" className="mb-1 shrink-0">
          <Logo iconOnly />
        </Link>

        <RailLink to="/" end label="Mapa" icon={MapIcon} active={isHome && !panel} />
        <RailLink to={panelLink('filtros')} label="Filtros y categorías" icon={FunnelIcon} active={panel === 'filtros'} />
        <RailLink to={panelLink('recientes')} label="Reportes recientes" icon={ClockIcon} active={panel === 'recientes'} />

        <span className="my-1 h-px w-8 shrink-0 bg-slate-900/10" />

        <RailLink to="/reports/new" label="Nuevo reporte" icon={CameraIcon} accent />
        {user && <RailLink to="/reports/mine" label="Mis reportes" icon={RectangleStackIcon} />}
        {isStaff && <RailLink to="/moderation" label="Moderación" icon={ShieldCheckIcon} />}
        {isAdmin && <RailLink to="/admin/reports" label="Gestionar reportes" icon={TableCellsIcon} />}
        {isAdmin && <RailLink to="/admin/stats" label="Estadísticas y PDF" icon={ChartBarIcon} />}

        <div className="mt-auto flex flex-col items-center gap-2">
          {user ? (
            <Menu>
              <MenuButton aria-label="Mi cuenta" className="group relative flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white shadow-lg ring-2 ring-white/70">
                {user.name.charAt(0).toUpperCase()}
              </MenuButton>
              <MenuItems
                anchor="right end"
                transition
                className="glass-strong z-[1300] ml-3 w-56 rounded-2xl p-1 transition duration-100 focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-bold text-slate-900">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                  <span className="mt-1 inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                    {ROLE[user.role]}
                  </span>
                </div>
                <MenuItem>
                  <button
                    onClick={() => {
                      logout()
                      navigate('/')
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 data-[focus]:bg-red-50/80"
                  >
                    <ArrowRightStartOnRectangleIcon className="size-4" /> Cerrar sesión
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>
          ) : (
            <>
              <RailLink to="/auth/register" label="Crear cuenta" icon={UserPlusIcon} />
              <RailLink to="/auth/login" label="Iniciar sesión" icon={ArrowRightEndOnRectangleIcon} />
            </>
          )}
        </div>
      </aside>

      <OfflineBanner />
      <InstallPrompt />

      {isHome ? (
        // El inicio es solo el mapa, a pantalla completa detrás de la barra
        <main className="fixed inset-0">
          <Outlet />
        </main>
      ) : (
        <main className="py-6 pl-[4.75rem] pr-4 md:pl-[6rem] md:pr-6">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      )}
    </div>
  )
}
