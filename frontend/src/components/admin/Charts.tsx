import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from 'recharts'
import { STATUS, SEVERITY } from '@/lib/labels'
import type { AdminStats } from '@/types'

/* Paleta salvia: series separadas por luminosidad (verde principal / salvia / verde grisáceo), legibles sin depender del matiz */
export const SERIES = { reportados: '#4c6b55', resueltos: '#92aa97', rechazados: '#c9c4b4' }
const AXIS = { fontSize: 12, fill: '#4f6655' }
const GRID = 'rgba(46, 68, 54, 0.1)'
const CURSOR = { fill: 'rgba(76, 107, 85, 0.07)' }
const LABEL = { fontSize: 12, fontWeight: 700, fill: '#1e2d24' }
/* Separación entre segmentos apilados: del color de la tarjeta */
const GAP = '#f8f6f0'
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtMonth = (key: string) => {
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`
}
const tooltipStyle = { borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.8)', background: 'rgba(248, 246, 240, 0.95)', color: '#1e2d24', fontSize: 13, boxShadow: '0 16px 40px rgb(30 45 36 / .18)' }
const tooltipText = { color: '#1e2d24' }

export function MonthlyChart({ data }: { data: AdminStats['monthly'] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tickFormatter={fmtMonth} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip labelFormatter={(m) => fmtMonth(String(m))} contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} cursor={CURSOR} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 13, color: '#415848' }} />
        <Bar dataKey="reportados" name="Reportados" fill={SERIES.reportados} radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="resueltos" name="Resueltos" fill={SERIES.resueltos} radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CategoryChart({ data }: { data: AdminStats['byCategory'] }) {
  const rows = data.map((c) => ({ ...c, rechazados: c.total - c.abiertos - c.resueltos }))
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 38 + 50)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={150} tick={{ ...AXIS, fill: '#34493b' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} cursor={CURSOR} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 13, color: '#415848' }} />
        {/* stroke del fondo = 2px de separación entre segmentos */}
        <Bar dataKey="abiertos" name="Abiertos" stackId="a" fill={SERIES.reportados} stroke={GAP} strokeWidth={2} />
        <Bar dataKey="resueltos" name="Resueltos" stackId="a" fill={SERIES.resueltos} stroke={GAP} strokeWidth={2} />
        <Bar dataKey="rechazados" name="No procedentes / canalizados" stackId="a" fill={SERIES.rechazados} stroke={GAP} strokeWidth={2} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="total" position="right" style={LABEL} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Barras horizontales de una sola serie (estado / gravedad) */
function SingleBars({ data }: { data: { label: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={data.length * 36 + 20}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={90} tick={{ ...AXIS, fill: '#34493b' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} cursor={CURSOR} formatter={(v) => [v, 'Reportes']} />
        <Bar dataKey="total" fill={SERIES.reportados} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="total" position="right" style={LABEL} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export const StatusChart = ({ data }: { data: AdminStats['byStatus'] }) => (
  <SingleBars data={data.map((d) => ({ label: STATUS[d.status].label, total: d.total }))} />
)

export const SeverityChart = ({ data }: { data: AdminStats['bySeverity'] }) => (
  <SingleBars data={data.map((d) => ({ label: SEVERITY[d.severity].label, total: d.total }))} />
)
