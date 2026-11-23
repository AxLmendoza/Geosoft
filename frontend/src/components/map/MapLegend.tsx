import { PIN_KINDS, PIN_KIND_ORDER, PinIcon } from './pinIcons'

/** Simbología: los mismos marcadores que en el mapa, con su significado */
export default function MapLegend({ className = '' }: { className?: string }) {
  return (
    <ul className={`space-y-2 text-sm text-slate-700 ${className}`}>
      {PIN_KIND_ORDER.map((k) => (
        <li key={k} className="flex items-center gap-2.5">
          <span className="flex w-7 justify-center"><PinIcon kind={k} height={28} /></span>
          <span className="leading-tight">
            <span className="font-semibold text-slate-900">{PIN_KINDS[k].label}</span>
            <span className="block text-xs text-slate-500">{PIN_KINDS[k].help}</span>
          </span>
        </li>
      ))}
      <li className="flex items-center gap-2.5">
        <span className="flex w-7 justify-center">
          <span className="gs-spread-center" />
        </span>
        <span className="leading-tight">
          <span className="font-semibold text-slate-900">Varios reportes en el mismo lugar</span>
          <span className="block text-xs text-slate-500">Sus pines se abren alrededor de este punto; toca cada uno para verlo</span>
        </span>
      </li>
    </ul>
  )
}
