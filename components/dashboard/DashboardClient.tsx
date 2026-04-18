"use client"

import { useEffect, useState } from "react"
import { formatCurrency, formatDateTime, PAYMENT_METHOD_LABELS } from "@/lib/utils"
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle,
  DollarSign, BarChart3, Clock, Sparkles, Loader2
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts"
import Link from "next/link"

interface DashboardData {
  salesToday: { total: number; count: number }
  salesMonth: { total: number; count: number }
  totalProducts: number
  lowStockProducts: any[]
  recentSales: any[]
  topProducts: any[]
  salesByHour: { hour: number; total: number; count: number }[]
}

interface Props {
  data: DashboardData
  userName: string
}

function StatCard({
  title, value, subtitle, icon: Icon, color, href
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  color: string
  href?: string
}) {
  const content = (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition group`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
          <p className="text-2xl font-black text-gray-800 dark:text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center flex-shrink-0`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  )

  if (href) return <Link href={href}>{content}</Link>
  return content
}

// Formatear horas para el gráfico
const formatHour = (h: number) => `${h}:00`

export default function DashboardClient({ data, userName }: Props) {
  const [mounted, setMounted] = useState(false)
  const [greeting, setGreeting] = useState("Buen día")

  useEffect(() => {
    setMounted(true)
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches")
  }, [])

  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setAiLoading(true)
      try {
        const res = await fetch("/api/ia/resumen-dia")
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled && json.summary) setAiSummary(json.summary)
      } catch {
        // silent
      } finally {
        if (!cancelled) setAiLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Llenar horas vacías en el gráfico
  const hoursData = Array.from({ length: 14 }, (_, i) => {
    const h = i + 7 // 7am a 9pm
    const found = data.salesByHour.find(r => r.hour === h)
    return {
      hour: formatHour(h),
      ventas: found?.total ?? 0,
      cantidad: found?.count ?? 0,
    }
  })

  return (
    <div className="p-6 space-y-6">
      {/* Bienvenida */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          {greeting}, {userName.split(" ")[0]} 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
          {mounted ? `Resumen del día · ${new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}` : "Resumen del día"}
        </p>
      </div>

      {/* Resumen IA del día */}
      {(aiLoading || aiSummary) && (
        <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-purple-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
            {aiLoading ? (
              <Loader2 size={18} className="text-white animate-spin" />
            ) : (
              <Sparkles size={18} className="text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide mb-0.5">
              Resumen con IA
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
              {aiLoading ? "Analizando tu día..." : aiSummary}
            </p>
          </div>
        </div>
      )}

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ventas de hoy"
          value={formatCurrency(data.salesToday.total)}
          subtitle={`${data.salesToday.count} transacciones`}
          icon={DollarSign}
          color="bg-green-500"
        />
        <StatCard
          title="Ventas del mes"
          value={formatCurrency(data.salesMonth.total)}
          subtitle={`${data.salesMonth.count} transacciones`}
          icon={TrendingUp}
          color="bg-blue-500"
        />
        <StatCard
          title="Productos activos"
          value={String(data.totalProducts)}
          icon={Package}
          color="bg-purple-500"
          href="/inventario"
        />
        <StatCard
          title="Stock bajo"
          value={String(data.lowStockProducts.length)}
          subtitle="requieren atención"
          icon={AlertTriangle}
          color="bg-orange-500"
          href="/inventario"
        />
      </div>

      {/* Gráfico de ventas por hora */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-800 dark:text-white">Ventas por hora — Hoy</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Monto total por hora del día</p>
          </div>
          <BarChart3 size={20} className="text-gray-300" />
        </div>
        <div className="h-48">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hoursData}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val: number) => [formatCurrency(val), "Ventas"]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}
                />
                <Area
                  type="monotone"
                  dataKey="ventas"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#colorVentas)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full bg-gray-50 dark:bg-gray-700/30 rounded-xl animate-pulse" />
          )}
        </div>
      </div>

      {/* Fila inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Últimas ventas */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 dark:text-white">Últimas ventas</h2>
            <Link href="/reportes" className="text-blue-600 text-sm hover:underline">Ver todas</Link>
          </div>
          {data.recentSales.length === 0 ? (
            <div className="text-center py-8 text-gray-300">
              <ShoppingCart size={40} className="mx-auto mb-2" />
              <p className="text-sm">No hay ventas hoy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentSales.slice(0, 6).map((sale: any) => (
                <div key={sale.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      #{sale.number} · {sale.items.length} producto{sale.items.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDateTime(sale.createdAt)} · {sale.user?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(sale.total)}</p>
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                      {PAYMENT_METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock bajo */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 dark:text-white">Alertas de stock</h2>
            <Link href="/inventario" className="text-blue-600 text-sm hover:underline">Gestionar</Link>
          </div>
          {data.lowStockProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-300">
              <Package size={40} className="mx-auto mb-2" />
              <p className="text-sm text-green-500">¡Todo el stock está OK!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.lowStockProducts.map((product: any) => (
                <div key={product.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={16} className="text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full"
                          style={{ width: `${Math.min(100, (product.stock / product.idealStock) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-orange-600 font-medium flex-shrink-0">
                        {product.stock}/{product.minStock} {product.unit}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Acceso rápido a POS */}
      <Link
        href="/pos"
        className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-5 hover:from-blue-700 hover:to-indigo-700 transition shadow-lg shadow-blue-500/30 group"
      >
        <div>
          <p className="font-bold text-lg">Ir a la Caja</p>
          <p className="text-blue-200 text-sm">Abrir el punto de venta</p>
        </div>
        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition">
          <ShoppingCart size={24} />
        </div>
      </Link>
    </div>
  )
}
