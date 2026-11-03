import { PinInput, PinInputField } from '@chakra-ui/pin-input'

type Props = {
  value: string
  onChange: (value: string) => void
  onComplete: (value: string) => void
  disabled?: boolean
}

/** 6 cuadros para el código de confirmación (Chakra UI PinInput estilizado con Tailwind) */
export default function TokenInput({ value, onChange, onComplete, disabled }: Props) {
  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      <PinInput value={value} onChange={onChange} onComplete={onComplete} isDisabled={disabled} otp type="number" autoFocus>
        {Array.from({ length: 6 }).map((_, i) => (
          <PinInputField
            key={i}
            className="size-11 rounded-xl border border-slate-300 bg-slate-50 text-center text-xl font-bold text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 sm:size-12"
          />
        ))}
      </PinInput>
    </div>
  )
}
