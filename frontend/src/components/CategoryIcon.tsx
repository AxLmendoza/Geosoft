import {
  BeakerIcon, BoltIcon, FireIcon, LightBulbIcon, TruckIcon, TrashIcon, SignalIcon,
  SparklesIcon, CloudIcon, QuestionMarkCircleIcon, ArrowDownCircleIcon,
} from '@heroicons/react/24/solid'
import type { ComponentType, SVGProps } from 'react'

const ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  agua: BeakerIcon,
  drenaje: ArrowDownCircleIcon,
  electricidad: BoltIcon,
  alumbrado: LightBulbIcon,
  baches: TruckIcon,
  basura: TrashIcon,
  senalizacion: SignalIcon,
  'areas-verdes': SparklesIcon,
  inundacion: CloudIcon,
  incendio: FireIcon,
}

export default function CategoryIcon({ slug, className = 'size-5' }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] ?? QuestionMarkCircleIcon
  return <Icon className={className} aria-hidden />
}
