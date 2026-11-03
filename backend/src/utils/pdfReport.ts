import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import type { Stats } from './stats'

/* ------------------------------------------------------------------ */
/*  Informe PDF del administrador (pdf-lib, sin dependencias nativas)  */
/* ------------------------------------------------------------------ */

const A4 = { w: 595.28, h: 841.89 }
const M = 42 // margen

const hex = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

const C = {
  ink: hex('#0f172a'),
  muted: hex('#64748b'),
  faint: hex('#94a3b8'),
  grid: hex('#e2e8f0'),
  surface: hex('#f8fafc'),
  brand: hex('#4f46e5'),
  white: rgb(1, 1, 1),
  // Series (validadas para daltonismo): reportados / resueltos / rechazados
  s1: hex('#4f46e5'),
  s2: hex('#0d9488'),
  s3: hex('#94a3b8'),
}

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  en_proceso: 'En proceso',
  resuelto: 'Resuelto',
  rechazado: 'Rechazado',
}
const SEVERITY_LABEL: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' }

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' })
const fmtDate = (d: Date | string | null | undefined) => (d ? dateFmt.format(new Date(d)) : '—')

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtMonth = (key: string) => {
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`
}

/** Helvetica estándar solo codifica WinAnsi: quitamos emojis y caracteres raros */
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
const safe = (text: string) =>
  text
    .normalize('NFC')
    .split('')
    .map((ch) => (ch.charCodeAt(0) < 256 || WIN_ANSI_EXTRA.includes(ch) ? ch : ''))
    .join('')
    .replace(/[\u0000-\u001f]/g, ' ')

const fmtHours = (h: number | null) => {
  if (h === null) return '—'
  if (h < 48) return `${h.toFixed(1)} h`
  return `${(h / 24).toFixed(1)} días`
}

class Doc {
  pdf!: PDFDocument
  page!: PDFPage
  font!: PDFFont
  bold!: PDFFont
  y = 0
  pageNo = 0

  static async create() {
    const d = new Doc()
    d.pdf = await PDFDocument.create()
    d.font = await d.pdf.embedFont(StandardFonts.Helvetica)
    d.bold = await d.pdf.embedFont(StandardFonts.HelveticaBold)
    d.pdf.setTitle('GeoScript - Informe de reportes ciudadanos')
    d.pdf.setAuthor('GeoScript')
    d.pdf.setLanguage('es-MX')
    return d
  }

  addPage() {
    this.page = this.pdf.addPage([A4.w, A4.h])
    this.pageNo++
    this.y = A4.h - M
    return this.page
  }

  /** Salta de página si no cabe `space` */
  ensure(space: number) {
    if (this.y - space < M + 20) this.addPage()
  }

  text(t: string, x: number, y: number, opts: { size?: number; bold?: boolean; color?: RGB; maxWidth?: number; align?: 'left' | 'right' | 'center' } = {}) {
    const size = opts.size ?? 10
    const font = opts.bold ? this.bold : this.font
    let str = safe(t)
    if (opts.maxWidth) str = this.fit(str, font, size, opts.maxWidth)
    const w = font.widthOfTextAtSize(str, size)
    const dx = opts.align === 'right' ? -w : opts.align === 'center' ? -w / 2 : 0
    this.page.drawText(str, { x: x + dx, y, size, font, color: opts.color ?? C.ink })
    return w
  }

  fit(str: string, font: PDFFont, size: number, maxWidth: number) {
    if (font.widthOfTextAtSize(str, size) <= maxWidth) return str
    while (str.length > 1 && font.widthOfTextAtSize(`${str}…`, size) > maxWidth) str = str.slice(0, -1)
    return `${str}…`
  }

  rect(x: number, y: number, w: number, h: number, color: RGB) {
    if (w <= 0 || h <= 0) return
    this.page.drawRectangle({ x, y, width: w, height: h, color })
  }

  line(x1: number, y1: number, x2: number, y2: number, color = C.grid, thickness = 0.6) {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness })
  }

  heading(title: string, subtitle?: string) {
    this.ensure(60)
    this.y -= 16
    this.text(title, M, this.y, { size: 13, bold: true })
    this.y -= 14
    if (subtitle) {
      this.text(subtitle, M, this.y, { size: 8.5, color: C.muted })
      this.y -= 12
    }
    this.y -= 4
  }

  legend(items: { label: string; color: RGB }[], x: number, y: number) {
    let cx = x
    items.forEach((it) => {
      this.rect(cx, y - 1, 8, 8, it.color)
      cx += 12
      cx += this.text(it.label, cx, y, { size: 8, color: C.muted }) + 14
    })
  }

  footer() {
    const pages = this.pdf.getPages()
    pages.forEach((p, i) => {
      p.drawText(safe(`GeoScript · Informe de reportes ciudadanos · Página ${i + 1} de ${pages.length}`), {
        x: M,
        y: 22,
        size: 7.5,
        font: this.font,
        color: C.faint,
      })
    })
  }
}

/** Escala "bonita" para el eje Y: 4 divisiones de 1, 2 o 5 × 10^n */
function niceMax(v: number) {
  const raw = Math.max(1, v / 4)
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * pow).find((st) => st >= raw)!
  return step * 4
}

/* --------------------------- Secciones ---------------------------- */

function cover(doc: Doc, stats: Stats, generatedBy: string) {
  const p = doc.addPage()
  p.drawRectangle({ x: 0, y: A4.h - 120, width: A4.w, height: 120, color: C.brand })
  doc.text('GeoScript', M, A4.h - 52, { size: 22, bold: true, color: C.white })
  doc.text('Informe de reportes ciudadanos', M, A4.h - 74, { size: 13, color: C.white })
  doc.text(
    `Periodo: ${fmtDate(stats.range.from)} – ${fmtDate(stats.range.to)}   ·   Generado: ${dateTimeFmt.format(new Date())}   ·   Por: ${generatedBy}`,
    M,
    A4.h - 98,
    { size: 8.5, color: hex('#c7d2fe'), maxWidth: A4.w - 2 * M },
  )
  doc.y = A4.h - 150

  // Tiles de KPIs (3 x 2)
  const t = stats.totals
  const tiles = [
    { label: 'Reportes recibidos', value: String(t.total) },
    { label: 'Resueltos', value: String(t.resueltos) },
    { label: 'Abiertos', value: String(t.abiertos) },
    { label: 'Tasa de resolución', value: `${(t.tasaResolucion * 100).toFixed(1)}%` },
    { label: 'Tiempo promedio de solución', value: fmtHours(t.promedioHorasSolucion) },
    { label: 'Eliminados (borrado lógico)', value: String(t.eliminados) },
  ]
  const gap = 10
  const tw = (A4.w - 2 * M - gap * 2) / 3
  const th = 58
  tiles.forEach((tile, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = M + col * (tw + gap)
    const y = doc.y - row * (th + gap) - th
    doc.rect(x, y, tw, th, C.surface)
    doc.text(tile.label, x + 12, y + th - 18, { size: 8.5, color: C.muted, maxWidth: tw - 24 })
    doc.text(tile.value, x + 12, y + 14, { size: 20, bold: true })
  })
  doc.y -= 2 * th + gap + 18

  doc.text(`Rechazados: ${t.rechazados}  ·  Ocultos por moderación: ${t.ocultos}  ·  Votos de la comunidad: ${t.votos}`, M, doc.y, { size: 8, color: C.muted })
  doc.y -= 12
  doc.text(`Usuarios: ${t.usuarios} (moderadores: ${t.moderadores}, baneados: ${t.baneados})  ·  Denuncias pendientes: ${t.denunciasPendientes}`, M, doc.y, { size: 8, color: C.muted })
  doc.y -= 14
}

function monthlyChart(doc: Doc, stats: Stats) {
  doc.heading('Reportados vs. resueltos por mes', 'Reportes creados en el mes y reportes que se marcaron como resueltos en ese mes')
  const H = 170
  doc.ensure(H + 40)
  const x0 = M + 26
  const w = A4.w - M - x0
  const top = doc.y - 14
  const base = top - H

  doc.legend([{ label: 'Reportados', color: C.s1 }, { label: 'Resueltos', color: C.s2 }], M, doc.y)

  const data = stats.monthly
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.reportados, d.resueltos])))
  for (let i = 0; i <= 4; i++) {
    const gy = base + (H * i) / 4
    doc.line(x0, gy, x0 + w, gy, i === 0 ? C.faint : C.grid)
    doc.text(String(Math.round((max * i) / 4)), x0 - 6, gy - 3, { size: 7, color: C.muted, align: 'right' })
  }

  const slot = w / Math.max(1, data.length)
  const barW = Math.min(14, (slot - 8) / 2)
  data.forEach((d, i) => {
    const cx = x0 + slot * i + slot / 2
    const h1 = (d.reportados / max) * H
    const h2 = (d.resueltos / max) * H
    doc.rect(cx - barW - 1, base, barW, h1, C.s1) // 2px de separación entre barras
    doc.rect(cx + 1, base, barW, h2, C.s2)
    if (data.length <= 12 || i % 2 === 0) doc.text(fmtMonth(d.month), cx, base - 11, { size: 7, color: C.muted, align: 'center' })
  })
  doc.y = base - 30
}

function categoryChart(doc: Doc, stats: Stats) {
  const rows = stats.byCategory
  doc.heading('Reportes por categoría', 'Abiertos, resueltos y rechazados por tipo de problema')
  if (!rows.length) {
    doc.text('Sin datos en el periodo.', M, doc.y, { size: 9, color: C.muted })
    doc.y -= 20
    return
  }
  doc.ensure(30 + rows.length * 20)
  doc.legend(
    [
      { label: 'Abiertos', color: C.s1 },
      { label: 'Resueltos', color: C.s2 },
      { label: 'Rechazados', color: C.s3 },
    ],
    M,
    doc.y,
  )
  doc.y -= 18
  const labelW = 150
  const x0 = M + labelW
  const w = A4.w - M - x0 - 30
  const max = Math.max(1, ...rows.map((r) => r.total))
  rows.forEach((r) => {
    const y = doc.y - 12
    doc.rect(M, y + 2, 7, 7, hex(r.color)) // color de identidad de la categoría
    doc.text(r.name, M + 12, y + 2, { size: 8.5, maxWidth: labelW - 18 })
    const rech = r.total - r.abiertos - r.resueltos
    let x = x0
    ;[
      [r.abiertos, C.s1],
      [r.resueltos, C.s2],
      [rech, C.s3],
    ].forEach(([v, color]) => {
      const bw = ((v as number) / max) * w
      if (bw > 0) {
        doc.rect(x, y, Math.max(bw - 2, 1), 11, color as RGB)
        x += bw
      }
    })
    doc.text(String(r.total), x + 4, y + 2, { size: 8.5, bold: true })
    doc.y -= 20
  })
  doc.y -= 6
}

function simpleBars(doc: Doc, title: string, rows: { label: string; value: number }[]) {
  doc.heading(title)
  doc.ensure(rows.length * 18 + 10)
  const labelW = 90
  const x0 = M + labelW
  const w = A4.w - M - x0 - 30
  const max = Math.max(1, ...rows.map((r) => r.value))
  rows.forEach((r) => {
    const y = doc.y - 12
    doc.text(r.label, M, y + 2, { size: 8.5 })
    const bw = (r.value / max) * w
    doc.rect(x0, y, bw, 10, C.s1)
    doc.text(String(r.value), x0 + bw + 4, y + 1.5, { size: 8.5, bold: true })
    doc.y -= 18
  })
  doc.y -= 4
}

type Col = { title: string; width: number; align?: 'left' | 'right' }

function table(doc: Doc, cols: Col[], rows: string[][], rowH = 16) {
  const drawHeader = () => {
    doc.rect(M, doc.y - rowH + 4, A4.w - 2 * M, rowH, C.surface)
    let x = M + 4
    cols.forEach((c) => {
      doc.text(c.title, c.align === 'right' ? x + c.width - 8 : x, doc.y - rowH + 9, { size: 7.5, bold: true, color: C.muted, align: c.align })
      x += c.width
    })
    doc.y -= rowH
  }
  doc.ensure(rowH * 3)
  drawHeader()
  rows.forEach((row) => {
    if (doc.y - rowH < M + 20) {
      doc.addPage()
      drawHeader()
    }
    let x = M + 4
    row.forEach((cell, i) => {
      const c = cols[i]
      doc.text(cell, c.align === 'right' ? x + c.width - 8 : x, doc.y - rowH + 9, { size: 7.5, maxWidth: c.width - 8, align: c.align })
      x += c.width
    })
    doc.line(M, doc.y - rowH + 4, A4.w - M, doc.y - rowH + 4)
    doc.y -= rowH
  })
  doc.y -= 10
}

/* ----------------------------- API -------------------------------- */

export async function buildStatsPdf(stats: Stats, generatedBy: string) {
  const doc = await Doc.create()

  cover(doc, stats, generatedBy)
  monthlyChart(doc, stats)
  categoryChart(doc, stats)

  simpleBars(doc, 'Reportes por estado', stats.byStatus.map((s) => ({ label: STATUS_LABEL[s.status], value: s.total })))
  simpleBars(doc, 'Reportes por gravedad', stats.bySeverity.map((s) => ({ label: SEVERITY_LABEL[s.severity], value: s.total })))

  doc.heading('Zonas prioritarias', 'Índice = suma de la gravedad de los reportes abiertos (baja 1 · media 2 · alta 3 · crítica 5)')
  if (stats.priorityZones.length) {
    table(
      doc,
      [
        { title: '#', width: 26 },
        { title: 'Colonia', width: 260 },
        { title: 'Abiertos', width: 75, align: 'right' },
        { title: 'Críticos', width: 75, align: 'right' },
        { title: 'Índice', width: 75, align: 'right' },
      ],
      stats.priorityZones.map((z, i) => [String(i + 1), z.colonia, String(z.abiertos), String(z.criticos), String(z.indice)]),
    )
  } else {
    doc.text('No hay reportes abiertos en el periodo.', M, doc.y, { size: 9, color: C.muted })
    doc.y -= 20
  }

  doc.addPage()
  doc.heading(`Detalle de reportes (${stats.reports.length})`, 'Incluye reportes eliminados (borrado lógico) y ocultos por moderación')
  table(
    doc,
    [
      { title: 'ID', width: 34 },
      { title: 'Fecha', width: 62 },
      { title: 'Título', width: 100 },
      { title: 'Categoría', width: 82 },
      { title: 'Colonia', width: 80 },
      { title: 'Estado', width: 58 },
      { title: 'Gravedad', width: 44 },
      { title: 'Resuelto', width: 0 },
    ].map((c, i, arr) => (i === arr.length - 1 ? { ...c, width: A4.w - 2 * M - arr.slice(0, -1).reduce((a, b) => a + b.width, 0) } : c)),
    stats.reports.map((r) => [
      `#${r.id}`,
      fmtDate(r.createdAt),
      r.title,
      r.category,
      r.colonia ?? '—',
      r.deletedAt ? 'Eliminado' : `${STATUS_LABEL[r.status]}${r.hidden ? ' (oculto)' : ''}`,
      SEVERITY_LABEL[r.severity],
      r.resolvedAt ? fmtDate(r.resolvedAt) : '—',
    ]),
  )

  doc.footer()
  return Buffer.from(await doc.pdf.save())
}
