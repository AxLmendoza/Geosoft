import type { ReactNode } from 'react'
import { LazyMotion, MotionConfig, m, type HTMLMotionProps, type Transition, type Variants } from 'motion/react'

const loadFeatures = () => import('./motionFeatures').then((mod) => mod.default)

/**
 * Animaciones de GeoScript (Motion).
 * - LazyMotion + `m` mantiene el peso bajo: las funciones de animación se cargan en
 *   un chunk aparte después del primer render (la interfaz nunca espera por ellas).
 * - reducedMotion="user": si el sistema pide "reducir movimiento", se omiten
 *   desplazamientos y escalas y solo quedan cambios de opacidad.
 */

/** Tokens de movimiento: un mismo ritmo para todo el producto */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const
export const SPRING: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }
export const DURATION = { fast: 0.15, base: 0.24, slow: 0.36 }

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig reducedMotion="user" transition={{ duration: DURATION.base, ease: EASE_OUT }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}

/** Entrada suave de cada pantalla (sin animación de salida para no retrasar la navegación) */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT }}
    >
      {children}
    </m.div>
  )
}

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
}

/** Contenedor que escalona la aparición de sus hijos (`StaggerItem`) */
export function Stagger({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <m.div variants={listVariants} initial="hidden" animate="show" {...props}>
      {children}
    </m.div>
  )
}

export function StaggerItem({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <m.div variants={itemVariants} {...props}>
      {children}
    </m.div>
  )
}

/** Aparición simple (fade + leve subida) para bloques sueltos */
export function FadeIn({ children, delay = 0, ...props }: HTMLMotionProps<'div'> & { delay?: number }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT, delay }}
      {...props}
    >
      {children}
    </m.div>
  )
}

export { m, AnimatePresence } from 'motion/react'
