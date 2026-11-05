import { Report } from '../models/Report'
import { Category } from '../models/Category'
import { Area } from '../models/Area'
import { User } from '../models/User'
import type { ReportEventName } from './events'

const front = () => (process.env.FRONTEND_URL ?? '').split(',')[0].trim()

/**
 * Datos que recibe n8n. Incluye el contacto del ciudadano (para avisarle del avance)
 * y el del área (para avisarle de reportes nuevos). No incluye contraseñas ni tokens.
 */
export async function buildEventPayload(event: ReportEventName, reportId: number, extra: Record<string, unknown>) {
  const report = await Report.findByPk(reportId, {
    paranoid: false,
    include: [
      { model: Category, attributes: ['id', 'name', 'slug'] },
      { model: Area, attributes: ['id', 'name', 'type', 'contactEmail'] },
      { model: User, attributes: ['id', 'name', 'email'] },
    ],
  })
  if (!report) return null
  return {
    event,
    sentAt: new Date().toISOString(),
    ...extra,
    report: {
      id: report.id,
      title: report.title,
      status: report.status,
      severity: report.severity,
      colonia: report.colonia,
      calle: report.calle,
      lat: Number(report.lat),
      lng: Number(report.lng),
      createdAt: report.createdAt,
      url: front() ? `${front()}/reports/${report.id}` : null,
      category: report.category ? { id: report.category.id, name: report.category.name, slug: report.category.slug } : null,
      area: report.area
        ? { id: report.area.id, name: report.area.name, type: report.area.type, contactEmail: report.area.contactEmail }
        : null,
    },
    citizen: report.user ? { id: report.user.id, name: report.user.name, email: report.user.email } : null,
  }
}
