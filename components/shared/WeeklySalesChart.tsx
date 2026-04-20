"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"

interface DayData {
  date: string    // ISO date string
  total: number
  count: number
}

interface WeeklySalesChartProps {
  data: DayData[]
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00") // Noon to avoid TZ issues
  return d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric" })
}

function formatCurrencyShort(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; name: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl text-sm">
      <p className="text-gray-300 font-medium mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
          <span className="text-gray-400">Ventas:</span>
          <span className="text-white font-semibold">
            {new Intl.NumberFormat("es-AR", {
              style: "currency",
              currency: "ARS",
              minimumFractionDigits: 0,
            }).format(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function WeeklySalesChart({ data }: WeeklySalesChartProps) {
  const chartData = data.map((d) => ({
    day: formatDay(d.date),
    total: d.total,
    count: d.count,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatCurrencyShort}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#9333ea"
          strokeWidth={2}
          fill="url(#salesGradient)"
          dot={{ fill: "#9333ea", r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#a855f7", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
