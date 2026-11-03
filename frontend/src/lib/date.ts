import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value))

/** 15 de octubre de 2026, 01:18 */
export const formatDateTime = (value: string | Date) =>
  format(toDate(value), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })

/** 15 oct 2026 */
export const formatShortDate = (value: string | Date) => format(toDate(value), 'd MMM yyyy', { locale: es })

/** hace 3 horas */
export const timeAgo = (value: string | Date) => formatDistanceToNow(toDate(value), { addSuffix: true, locale: es })

/** Hoy, 14:30 · Ayer, 09:10 · 12 oct, 18:00 */
export function formatRelativeDay(value: string | Date) {
  const d = toDate(value)
  const time = format(d, 'HH:mm')
  if (isToday(d)) return `Hoy, ${time}`
  if (isYesterday(d)) return `Ayer, ${time}`
  return format(d, "d MMM, HH:mm", { locale: es })
}
