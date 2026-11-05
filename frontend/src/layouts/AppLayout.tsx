import type { ComponentType, SVGProps } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
  ArrowRightEndOnRectangleIcon, ArrowRightStartOnRectangleIcon, BuildingOffice2Icon, CameraIcon, ChartBarIcon, ClockIcon,
  FunnelIcon, InboxStackIcon, MapIcon, RectangleStackIcon, ShieldCheckIcon, TableCellsIcon, UserCircleIcon, UserPlusIcon,
} from '@heroicons/react/24/outline'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { ROLE } from '@/lib/labels'
import Logo from '@/components/ui/Logo'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import OfflineBanner from '@/components/pwa/OfflineBanner'

type Icon = ComponentType<SVGProps<SVGSVGElement>>
type NavItem = { to: string; label: string; icon: Icon; show: boolean }

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

/** Pestaña de la barra inferior en el celular */
function TabLink({ to, label, icon: Icon, end }: { to: string; label: string; icon: Icon; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-bold transition ${isActive ? 'text-indigo-700' : 'text-slate-500'}`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`flex h-7 w-12 items-center justify-center rounded-full transition ${isActive ? 'bg-indigo-100' : ''}`}>
            <Icon className="size-6" />
          </span>
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export default function AppLayout() {
  const { user, isStaff, isAdmin, canAttend } = useAuth()
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

  /** Secciones de trabajo según el rol (el backend también valida cada una) */
  const workItems: NavItem[] = [
    { to: '/attention', label: 'Bandeja de atención', icon: InboxStackIcon, show: canAttend },
    { to: '/moderation', label: 'Moderación', icon: ShieldCheckIcon, show: isStaff },
    { to: '/admin/reports', label: 'Gestionar reportes', icon: TableCellsIcon, show: isAdmin },
    { to: '/admin/areas', label: 'Áreas y distribución', icon: BuildingOffice2Icon, show: isAdmin },
    { to: '/admin/stats', label: 'Estadísticas y PDF', icon: ChartBarIcon, show: isAdmin },
  ]

  const doLogout = () => {
    logout()
    navigate('/')
  }

  const accountMenu = (anchor: 'right end' | 'top end') =>
    user && (
      <MenuItems
        anchor={anchor}
        transition
        className="glass-strong z-[1300] w-64 rounded-2xl p-1 transition duration-100 [--anchor-gap:12px] focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        <div className="px-3 py-2">
          <p className="truncate text-sm font-bold text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
          <span className="mt-1 inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700">{ROLE[user.role]}</span>
        </div>
        {/* En el celular las secciones de trabajo viven aquí */}
        {anchor === 'top end' &&
          workItems
            .filter((i) => i.show && i.to !== '/attention')
            .map((i) => (
              <MenuItem key={i.to}>
                <Link to={i.to} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 data-[focus]:bg-indigo-50/80">
                  <i.icon className="size-5" /> {i.label}
                </Link>
              </MenuItem>
            ))}
        <MenuItem>
          <button onClick={doLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-600 data-[focus]:bg-red-50/80">
            <ArrowRightStartOnRectangleIcon className="size-5" /> Cerrar sesión
          </button>
        </MenuItem>
      </MenuItems>
    )

  return (
    <div className="min-h-dvh">
      {/* ---------- Escritorio / tablet: barra lateral de cristal ---------- */}
      <aside className="glass fixed bottom-3 left-3 top-3 z-40 hidden w-16 flex-col items-center gap-2 overflow-y-auto rounded-3xl py-3 md:flex" aria-label="Navegación principal">
        <Link to="/" aria-label="Inicio" className="mb-1 shrink-0">
          <Logo iconOnly />
        </Link>

        <RailLink to="/" end label="Mapa" icon={MapIcon} active={isHome && !panel} />
        <RailLink to={panelLink('filtros')} label="Filtros y categorías" icon={FunnelIcon} active={panel === 'filtros'} />
        <RailLink to={panelLink('recientes')} label="Reportes recientes" icon={ClockIcon} active={panel === 'recientes'} />

        <span className="my-1 h-px w-8 shrink-0 bg-slate-900/10" />

        <RailLink to="/reports/new" label="Nuevo reporte" icon={CameraIcon} accent />
        {user && <RailLink to="/reports/mine" label="Mis reportes" icon={RectangleStackIcon} />}
        {workItems.filter((i) => i.show).map((i) => <RailLink key={i.to} to={i.to} label={i.label} icon={i.icon} />)}

        <div className="mt-auto flex flex-col items-center gap-2">
          {user ? (
            <Menu>
              <MenuButton aria-label="Mi cuenta" className="group relative flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white shadow-lg ring-2 ring-white/70">
                {user.name.charAt(0).toUpperCase()}
              </MenuButton>
              {accountMenu('right end')}
            </Menu>
          ) : (
            <>
              <RailLink to="/auth/register" label="Crear cuenta" icon={UserPlusIcon} />
              <RailLink to="/auth/login" label="Iniciar sesión" icon={ArrowRightEndOnRectangleIcon} />
            </>
          )}
        </div>
      </aside>

      {/* ---------- Celular: barra inferior con acceso rápido ---------- */}
      <nav
        className="glass-strong fixed inset-x-0 bottom-0 z-40 flex items-end gap-1 rounded-t-3xl px-2 pt-1.5 md:hidden"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        aria-label="Navegación principal"
      >
        <TabLink to="/" end label="Mapa" icon={MapIcon} />
        {user ? <TabLink to="/reports/mine" label="Mis reportes" icon={RectangleStackIcon} /> : <TabLink to="/auth/register" label="Crear cuenta" icon={UserPlusIcon} />}
        <div className="flex flex-1 justify-center">
          <NavLink
            to="/reports/new"
            aria-label="Nuevo reporte"
            className="-mt-6 flex size-16 flex-col items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-600/40 ring-4 ring-white active:scale-95"
          >
            <CameraIcon className="size-7" />
            <span className="text-[10px] font-extrabold leading-none">Reportar</span>
          </NavLink>
        </div>
        {canAttend ? <TabLink to="/attention" label="Atención" icon={InboxStackIcon} /> : <TabLink to={panelLink('recientes')} label="Recientes" icon={ClockIcon} />}
        {user ? (
          <Menu as="div" className="flex min-w-0 flex-1">
            <MenuButton className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-bold text-slate-500 data-[open]:text-indigo-700">
              <span className="flex h-7 w-12 items-center justify-center">
                <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </span>
              Cuenta
            </MenuButton>
            {accountMenu('top end')}
          </Menu>
        ) : (
          <TabLink to="/auth/login" label="Entrar" icon={UserCircleIcon} />
        )}
      </nav>

      <OfflineBanner />
      <InstallPrompt />

      {isHome ? (
        // El inicio es solo el mapa; en el celular termina donde empieza la barra inferior
        <main className="fixed inset-x-0 top-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-0">
          <Outlet />
        </main>
      ) : (
        <main className="px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] md:py-6 md:pl-[6rem] md:pr-6">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      )}
    </div>
  )
}
