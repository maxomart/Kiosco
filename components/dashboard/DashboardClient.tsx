"use client"

import { useEffect, useState } from "react"
import { motion, type Variants } from "framer-motion"
import { formatCurrency, formatDateTime, PAYMENT_METHOD_LABELS } from "@/lib/utils"
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle,
  DollarSign, BarChart3, Clock, Sparkles, Loader2,
  Receipt, Wallet, Truck, ArrowRight
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts"
import Link from "next/link"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { Progress } from "@/components/ui/progress"

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

const containerVar: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}
const itemVar: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
}

function StatCard({
  title, value, subtitle, icon: Icon, iconColor, href, money,
}: {
  title: string
  value: number | string
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  href?: string
  money?: boolean
}) {
  const content = (
    <motion.div
      variants={itemVar}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="card-glow rounded-2xl p-5 h-full group relative overflow-hidden"
    >
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl"
        style={{ background: `rgb(${iconColor} / 0.3)` }}
      />
      <div className="flex items-start justify-between relative">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wider">{title}</p>
          <div className="text-2xl md:text-3xl font-bold text-white mt-2">
            {typeof value === "number" ? (
              money ? (
                <AnimatedNumber value={value} prefix="$ " format={{ maximumFractionDigits: 2 }} />
              ) : (
                <AnimatedNumber value={value} />
              )
            ) : value}
          </div>
          {subtitle && <p className="text-xs text-white/40 mt-1">{subtitle}</p>}
        </div>
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ml-3"
          style={{
            background: `linear-gradient(135deg, rgb(${iconColor} / 0.2), rgb(${iconColor} / 0.08))`,
            border: `1px solid rgb(${iconColor} / 0.3)`,
          }}
        >
          <Icon size={20} style={{ color: `rgb(${iconColor})` }} />
        </div>
      </div>
    </motion.div>
  )
  if (href) return <Link href={href}>{content}</Link>
  return content
}

function QuickAction({
  label, icon: Icon, href, tone,
}: {
  label: string
  icon: React.ElementType
  href: string
  tone: "purple" | "emerald" | "sky" | "orange" | "indigo"
}) {
  const TONES: Record<string, string> = {
    purple: "from-purple-500/80 to-indigo-500/80 hover:from-purple-500 hover:to-indigo-500",
    emerald: "from-emerald-500/80 to-teal-500/80 hover:from-emerald-500 hover:to-teal-500",
    sky: "from-sky-500/80 to-blue-500/80 hover:from-sky-500 hover:to-blue-500",
    orange: "from-orange-500/80 to-rose-500/80 hover:from-orange-500 hover:to-rose-500",
    indigo: "from-indigo-500/80 to-purple-500/80 hover:from-indigo-500 hover:to-purple-500",
  }
  return (
    <Link
      href={href}
      className={`bg-gradient-to-br ${TONES[tone]} text-white rounded-2xl px-4 py-3.5 flex items-center justify-between transition-all active:scale-[0.98] group`}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} />
        <span className="font-semibold text-sm">{label}</span>
      </div>
      <ArrowRight size={16} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
    </Link>
  )
}

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
      } catch {}
      finally { if (!cancelled) setAiLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const hoursData = Array.from({ length: 14 }, (_, i) => {
    const h = i + 7
    const found = data.salesByHour.find(r => r.hour === h)
    return {
      hour: formatHour(h),
      ventas: found?.total ?? 0,
      cantidad: found?.count ?? 0,
    }
  })

  return (
    <motion.div
      className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto"
      variants={containerVar}
      initial="hidden"
      animate="visible"
    >
      {/* Bienvenida */}
      <motion.div variants={itemVar} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {greeting}, {userName.split(" ")[0]} <span className="inline-block animate-float-slow">👋</span>
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {mounted ? new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Resumen del día"}
          </p>
        </div>
      </motion.div>

      {/* Resumen IA */}
      {(aiLoading || aiSummary) && (
        <motion.div
          variants={itemVar}
          className="card-glow rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden"
        >
          <div className="absolute inset-0 animate-shimmer pointer-events-none" />
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative"
            style={{
              background: "linear-gradient(135deg, rgb(var(--glow-primary)), rgb(var(--glow-secondary)))",
            }}
          >
            {aiLoading ? <Loader2 size={18} className="text-white animate-spin" /> : <Sparkles size={18} className="text-white" />}
          </div>
          <div className="flex-1 min-w-0 relative">
            <p className="text-[11px] font-bold text-purple-300 uppercase tracking-[0.15em] mb-0.5">Resumen con IA</p>
            <p className="text-sm text-white/80 leading-relaxed">
              {aiLoading ? "Analizando tu día..." : aiSummary}
            </p>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Ventas de hoy" value={data.salesToday.total} subtitle={`${data.salesToday.count} transacciones`} icon={DollarSign} iconColor="34 197 94" money />
        <StatCard title="Ventas del mes" value={data.salesMonth.total} subtitle={`${data.salesMonth.count} transacciones`} icon={TrendingUp} iconColor="59 130 246" money />
        <StatCard title="Productos activos" value={data.totalProducts} icon={Package} iconColor="139 92 246" href="/inventario" />
        <StatCard title="Stock bajo" value={data.lowStockProducts.length} subtitle="requieren atención" icon={AlertTriangle} iconColor="249 115 22" href="/inventario" />
      </div>

      {/* Gráfico + acciones rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVar} className="lg:col-span-2 card-glow rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-white">Ventas últimos 7 días</h2>
              <p className="text-xs text-white/40 mt-0.5">Monto total por hora · hoy</p>
            </div>
            <Link href="/reportes" className="text-sm text-purple-300 hover:text-purple-200 flex items-center gap-1">
              Ver reportes <ArrowRight size={14} />
            </Link>
          </div>
          <div className="h-56">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hoursData}>
                  <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(var(--glow-primary))" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="rgb(var(--glow-primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} stroke="rgba(255,255,255,0.1)" />
                  <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} stroke="rgba(255,255,255,0.1)" />
                  <Tooltip
                    formatter={(val: number) => [formatCurrency(val), "Ventas"]}
                    contentStyle={{
                      background: "#0d0d18",
                      borderRadius: "12px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                    }}
                    cursor={{ stroke: "rgb(var(--glow-primary))", strokeWidth: 1, strokeDasharray: "3 3" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ventas"
                    stroke="rgb(var(--glow-primary))"
                    strokeWidth={2.5}
                    fill="url(#colorVentas)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full bg-white/5 rounded-xl animate-pulse" />
            )}
          </div>
        </motion.div>

        <motion.div variants={itemVar} className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-bold text-white text-sm">Acciones rápidas</h2>
          </div>
          <div className="space-y-2.5">
            <QuickAction label="Nueva venta" icon={ShoppingCart} href="/pos" tone="purple" />
            <QuickAction label="Gestionar caja" icon={Wallet} href="/caja" tone="emerald" />
            <QuickAction label="Registrar carga" icon={Truck} href="/cargas" tone="sky" />
            <QuickAction label="Cargar gasto" icon={Receipt} href="/gastos" tone="orange" />
            <QuickAction label="Ver inventario" icon={Package} href="/inventario" tone="indigo" />
          </div>
        </motion.div>
      </div>

      {/* Fila inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVar} className="card-glow rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">Últimas ventas</h2>
            <Link href="/reportes" className="text-purple-300 text-sm hover:text-purple-200">Ver todas</Link>
          </div>
          {data.recentSales.length === 0 ? (
            <div className="text-center py-8 text-white/30">
              <ShoppingCart size={40} className="mx-auto mb-2" />
              <p className="text-sm">No hay ventas hoy</p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.recentSales.slice(0, 6).map((sale: any) => (
                <div key={sale.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      #{sale.number} · {sale.items.length} producto{sale.items.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-white/40">{formatDateTime(sale.createdAt)} · {sale.user?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">{formatCurrency(sale.total)}</p>
                    <span className="text-[10px] bg-white/5 text-white/60 px-2 py-0.5 rounded-full border border-white/10">
                      {PAYMENT_METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div variants={itemVar} className="card-glow rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">Alertas de stock</h2>
            <Link href="/inventario" className="text-purple-300 text-sm hover:text-purple-200">Gestionar</Link>
          </div>
          {data.lowStockProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package size={40} className="mx-auto mb-2 text-emerald-400/50" />
              <p className="text-sm text-emerald-300">¡Todo el stock está OK!</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {data.lowStockProducts.map((product: any) => {
                const pct = product.idealStock > 0
                  ? Math.min(100, (product.stock / product.idealStock) * 100)
                  : 0
                const tone = pct < 25 ? "danger" : pct < 50 ? "warning" : "brand"
                return (
                  <div key={product.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <AlertTriangle size={15} className="text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-white truncate">{product.name}</p>
                        <span className="text-xs text-orange-300 font-medium flex-shrink-0 ml-2">
                          {product.stock}/{product.minStock} {product.unit}
                        </span>
                      </div>
                      <Progress value={pct} tone={tone as any} className="h-1.5" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* CTA final */}
      <motion.div variants={itemVar}>
        <Link
          href="/pos"
          className="relative overflow-hidden flex items-center justify-between rounded-2xl p-5 group border border-white/10 bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:via-indigo-500 hover:to-purple-600 transition-all brand-glow"
        >
          <div className="absolute inset-0 animate-shimmer pointer-events-none opacity-40" />
          <div className="relative">
            <p className="font-bold text-lg text-white">Ir a la Caja</p>
            <p className="text-white/70 text-sm">Abrir el punto de venta</p>
          </div>
          <div className="relative w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 group-hover:scale-105 transition">
            <ShoppingCart size={24} className="text-white" />
          </div>
        </Link>
      </motion.div>
    </motion.div>
  )
}
