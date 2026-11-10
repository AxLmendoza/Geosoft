import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { useQuery } from '@tanstack/react-query'
import { getFlags } from '@/api/ModerationAPI'
import FlagsPanel from '@/components/moderation/FlagsPanel'
import ReportsPanel from '@/components/moderation/ReportsPanel'
import BlacklistPanel from '@/components/moderation/BlacklistPanel'
import { FadeIn, m, SPRING } from '@/components/ui/Motion'

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
        <TabList className="flex gap-6 overflow-x-auto border-b border-line">
          {tabs.map((t) => (
            <Tab
              key={t.name}
              className="relative -mb-px flex min-h-11 shrink-0 items-center gap-2 rounded-t-lg pb-3 pt-1 text-[15px] font-semibold text-slate-500 outline-none transition-colors data-[focus]:outline-2 data-[focus]:outline-brand-600 data-[hover]:text-slate-800 data-[selected]:text-brand-700"
            >
              {({ selected }) => (
                <>
                  {t.name}
                  {!!t.badge && <span className="min-w-5 rounded-full bg-red-600 px-1.5 text-center text-xs tabular-nums text-white">{t.badge}</span>}
                  {selected && <m.span layoutId="moderation-tab" transition={SPRING} className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600" aria-hidden />}
                </>
              )}
            </Tab>
          ))}
        </TabList>
        <TabPanels className="mt-5">
          {tabs.map((t) => (
            <TabPanel key={t.name}><FadeIn>{t.panel}</FadeIn></TabPanel>
          ))}
        </TabPanels>
      </TabGroup>
    </div>
  )
}
