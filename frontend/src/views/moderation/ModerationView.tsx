import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { useQuery } from '@tanstack/react-query'
import { getFlags } from '@/api/ModerationAPI'
import FlagsPanel from '@/components/moderation/FlagsPanel'
import ReportsPanel from '@/components/moderation/ReportsPanel'
import BlacklistPanel from '@/components/moderation/BlacklistPanel'

/** Moderación de contenido. La gestión de usuarios tiene su propia sección (/users). */
export default function ModerationView() {
  const { data: pending = [] } = useQuery({ queryKey: ['flags', 'pendiente'], queryFn: () => getFlags('pendiente') })

  const tabs = [
    { name: 'Denuncias', badge: pending.length, panel: <FlagsPanel /> },
    { name: 'Contenido publicado', panel: <ReportsPanel /> },
    { name: 'Correos vetados', panel: <BlacklistPanel /> },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Moderación</h1>
        <p className="page-subtitle">Revisa denuncias de información falsa, imágenes no aptas o spam, y controla qué se publica en el mapa.</p>
      </header>
      <TabGroup>
        <TabList className="flex gap-6 overflow-x-auto border-b border-slate-200">
          {tabs.map((t) => (
            <Tab
              key={t.name}
              className="-mb-px flex shrink-0 items-center gap-2 border-b-2 border-transparent pb-3 text-sm font-semibold text-slate-500 outline-none data-[hover]:text-slate-800 data-[selected]:border-indigo-600 data-[selected]:text-indigo-700"
            >
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
