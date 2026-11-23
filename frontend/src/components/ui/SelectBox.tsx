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
      {label && <span className="label">{label}</span>}
      <Listbox value={value} onChange={onChange}>
        <ListboxButton className="relative min-h-11 w-full cursor-pointer rounded-xl border border-line-strong bg-white/70 py-2.5 shadow-xs pl-3.5 pr-10 text-left text-[15px] text-slate-900 transition hover:border-slate-400 focus:outline-none data-[focus]:border-brand-600 data-[focus]:ring-4 data-[focus]:ring-brand-600/15 data-[open]:border-brand-600">
          <span className="block truncate">{selected?.label}</span>
          <ChevronUpDownIcon className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          transition
          className="z-[1300] max-h-72 w-[var(--button-width)] origin-top overflow-auto rounded-xl border border-line-strong bg-surface-raised/95 p-1 backdrop-blur-xl text-[15px] shadow-pop [--anchor-gap:6px] focus:outline-none transition duration-150 ease-out data-[closed]:-translate-y-1 data-[closed]:scale-[0.98] data-[closed]:opacity-0"
        >
          {options.map((o) => (
            <ListboxOption
              key={String(o.value)}
              value={o.value}
              className="group flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-slate-700 data-[focus]:bg-brand-50 data-[focus]:text-brand-900 data-[selected]:font-semibold data-[selected]:text-brand-800"
            >
              <CheckIcon className="invisible size-4 shrink-0 text-brand-600 group-data-[selected]:visible" aria-hidden />
              {o.label}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
    </div>
  )
}
