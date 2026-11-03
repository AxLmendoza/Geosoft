import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'

export type Option<T> = { value: T; label: string }

type Props<T> = {
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  label?: string
  className?: string
}

/** Select accesible con HeadlessUI Listbox */
export default function SelectBox<T extends string | number>({ value, onChange, options, label, className = '' }: Props<T>) {
  const selected = options.find((o) => o.value === value) ?? options[0]
  return (
    <div className={className}>
      {label && <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>}
      <Listbox value={value} onChange={onChange}>
        <ListboxButton className="relative w-full cursor-pointer rounded-lg bg-white/60 py-2 pl-3 pr-9 text-left text-sm shadow-sm ring-1 ring-white/70 backdrop-blur focus:outline-none data-[focus]:ring-2 data-[focus]:ring-indigo-500">
          <span className="block truncate">{selected?.label}</span>
          <ChevronUpDownIcon className="pointer-events-none absolute right-2 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          transition
          className="z-[1300] mt-1 max-h-64 w-[var(--button-width)] overflow-auto glass-strong rounded-xl py-1 text-sm focus:outline-none transition duration-100 data-[closed]:opacity-0"
        >
          {options.map((o) => (
            <ListboxOption
              key={String(o.value)}
              value={o.value}
              className="group flex cursor-pointer items-center gap-2 px-3 py-2 data-[focus]:bg-indigo-50/80 data-[selected]:font-semibold"
            >
              <CheckIcon className="invisible size-4 text-indigo-600 group-data-[selected]:visible" />
              {o.label}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
    </div>
  )
}
