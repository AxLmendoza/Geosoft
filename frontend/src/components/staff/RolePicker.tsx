import { Radio, RadioGroup } from '@headlessui/react'
import { ROLE, STAFF_ROLE_HELP } from '@/lib/labels'

type StaffRole = 'operativo' | 'moderador'

/** Elección de rol con su explicación visible (no un select con nombres técnicos) */
export default function RolePicker({ value, onChange, disabled = false }: { value: StaffRole; onChange: (r: StaffRole) => void; disabled?: boolean }) {
  return (
    <RadioGroup value={value} onChange={onChange} disabled={disabled} aria-label="Rol en la plataforma" className="grid gap-2 sm:grid-cols-2">
      {(['operativo', 'moderador'] as const).map((role) => (
        <Radio
          key={role}
          value={role}
          className="group relative flex cursor-pointer gap-3 rounded-xl border border-slate-300 bg-white/45 p-3.5 transition hover:border-slate-400 data-[checked]:border-brand-600 data-[checked]:bg-brand-50/60 data-[checked]:ring-1 data-[checked]:ring-brand-600 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[focus]:outline-2 data-[focus]:outline-offset-2 data-[focus]:outline-brand-600"
        >
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-slate-400 bg-white group-data-[checked]:border-brand-600" aria-hidden>
            <span className="size-2 rounded-full bg-brand-600 opacity-0 group-data-[checked]:opacity-100" />
          </span>
          <span>
            <span className="block font-semibold text-slate-900">{ROLE[role]}</span>
            <span className="mt-0.5 block text-sm text-slate-600">{STAFF_ROLE_HELP[role]}</span>
          </span>
        </Radio>
      ))}
    </RadioGroup>
  )
}
