import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/20/solid'

export type Action = { label: string; onClick: () => void; danger?: boolean; hidden?: boolean; disabled?: boolean }

/**
 * Agrupa acciones secundarias (o peligrosas) en un menú con texto,
 * en lugar de una fila de botones con solo íconos.
 */
export default function ActionMenu({ actions, label = 'Más acciones' }: { actions: Action[]; label?: string }) {
  const visible = actions.filter((a) => !a.hidden)
  if (!visible.length) return null
  return (
    <Menu>
      <MenuButton className="btn-secondary btn-compact">
        {label} <ChevronDownIcon className="size-4 text-slate-400" aria-hidden />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        transition
        className="z-[1300] w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg [--anchor-gap:4px] focus:outline-none data-[closed]:opacity-0"
      >
        {visible.map((a) => (
          <MenuItem key={a.label} disabled={a.disabled}>
            <button
              onClick={a.onClick}
              className={`w-full rounded-md px-3 py-2 text-left text-sm data-[disabled]:opacity-40 ${a.danger ? 'text-red-700 data-[focus]:bg-red-50' : 'text-slate-700 data-[focus]:bg-slate-100'}`}
            >
              {a.label}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  )
}
