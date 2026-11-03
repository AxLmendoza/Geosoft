import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from 'recharts'
import { STATUS, SEVERITY } from '@/lib/labels'
import type { AdminStats } from '@/types'

/* Paleta validada para daltonismo (ΔE ≥ 22): reportados / resueltos; gris neutro para rechazados */
export const SERIES = { reportados: '#4f46e5', resueltos: '#0d9488', rechazados: '#94a3b8' }
const AXIS = { fontSize: 12, fill: '#64748b' }
const GRID = '#e2e8f0'
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtMonth = (key: string) => {
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`
}
const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, boxShadow: '0 8px 24px rgb(15 23 42 / .08)' }

export function MonthlyChart({ data }: { data: AdminStats['monthly'] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tickFormatter={fmtMonth} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip labelFormatter={(m) => fmtMonth(String(m))} contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} />
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
        <YAxis type="category" dataKey="name" width={150} tick={{ ...AXIS, fill: '#334155' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} />
        {/* stroke blanco = 2px de separación entre segmentos */}
        <Bar dataKey="abiertos" name="Abiertos" stackId="a" fill={SERIES.reportados} stroke="#fff" strokeWidth={2} />
        <Bar dataKey="resueltos" name="Resueltos" stackId="a" fill={SERIES.resueltos} stroke="#fff" strokeWidth={2} />
        <Bar dataKey="rechazados" name="Rechazados" stackId="a" fill={SERIES.rechazados} stroke="#fff" strokeWidth={2} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="total" position="right" style={{ fontSize: 12, fontWeight: 700, fill: '#0f172a' }} />
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
        <YAxis type="category" dataKey="label" width={90} tick={{ ...AXIS, fill: '#334155' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} formatter={(v) => [v, 'Reportes']} />
        <Bar dataKey="total" fill={SERIES.reportados} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="total" position="right" style={{ fontSize: 12, fontWeight: 700, fill: '#0f172a' }} />
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
