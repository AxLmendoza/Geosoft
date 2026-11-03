import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { FlagIcon, MapIcon, NoSymbolIcon, UsersIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { getFlags } from '@/api/ModerationAPI'
import { useAuth } from '@/hooks/useAuth'
import FlagsPanel from '@/components/moderation/FlagsPanel'
import ReportsPanel from '@/components/moderation/ReportsPanel'
import UsersPanel from '@/components/moderation/UsersPanel'
import BlacklistPanel from '@/components/moderation/BlacklistPanel'

export default function ModerationView() {
  const { isAdmin } = useAuth()
  const { data: pending = [] } = useQuery({ queryKey: ['flags', 'pendiente'], queryFn: () => getFlags('pendiente') })

  const tabs = [
    { name: 'Denuncias', icon: FlagIcon, badge: pending.length, panel: <FlagsPanel /> },
    { name: 'Reportes', icon: MapIcon, panel: <ReportsPanel /> },
    { name: isAdmin ? 'Usuarios y moderadores' : 'Usuarios', icon: UsersIcon, panel: <UsersPanel /> },
    { name: 'Lista negra', icon: NoSymbolIcon, panel: <BlacklistPanel /> },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold text-slate-900">Moderación</h1>
        <p className="text-slate-500">
          Revisa denuncias de información falsa, imágenes no aptas o datos basura.
          {isAdmin && ' Como administrador también puedes asignar moderadores.'}
        </p>
      </header>
      <TabGroup>
        <TabList className="flex gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1">
          {tabs.map((t) => (
            <Tab
              key={t.name}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-slate-600 outline-none data-[hover]:text-slate-900 data-[selected]:bg-white data-[selected]:text-indigo-700 data-[selected]:shadow"
            >
              <t.icon className="size-5" />
              {t.name}
              {!!t.badge && <span className="rounded-full bg-red-600 px-1.5 text-xs text-white">{t.badge}</span>}
            </Tab>
          ))}
        </TabList>
        <TabPanels className="mt-5">
          {tabs.map((t) => (
            <TabPanel key={t.name}>{t.panel}</TabPanel>
          ))}
        </TabPanels>
      </TabGroup>
    </div>
  )
}
