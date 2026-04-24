import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ShoppingCart,
  Receipt,
  TrendingUp,
  Package,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Truck,
  TrendingDown,
  Sparkles,
  RefreshCw,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatCurrency } from "@/lib/utils"
import StatCard from "@/components/shared/StatCard"
import WeeklySalesChart from "@/components/shared/WeeklySalesChart"
import { AnimatedStagger, AnimatedItem } from "@/components/shared/AnimatedStagger"
import { OnboardingChecklist } from "@/components/shared/OnboardingChecklist"
import { Progress } from "@/components/ui/progress"

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

async function getTodayStats(tenantId: string) {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const yesterdayEnd = new Date(todayEnd)
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1)

  const [todaySales, yesterdaySales, lowStockProducts] = await Promise.all([
    db.sale.findMany({
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      select: { total: true, items: { select: { costPrice: true, quantity: true } } },
    }),
    db.sale.findMany({
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
      },
      select: { total: true },
    }),
    // Fetch all active products and filter in JS (Prisma can't compare two columns natively without raw query)
    db.product
      .findMany({
        where: { tenantId, active: true },
        select: { id: true, name: true, stock: true, minStock: true },
        orderBy: { stock: "asc" },
      })
      .then((ps: { id: string; name: string; stock: number; minStock: number }[]) =>
        ps.filter((p) => p.stock <= p.minStock).slice(0, 10)
      )
      .catch(() => [] as { id: string; name: string; stock: number; minStock: number }[]),
  ])

  const todayTotal = todaySales.reduce(
    (acc: number, s: { total: unknown; items: { costPrice: unknown; quantity: number }[] }) =>
      acc + Number(s.total),
    0
  )
  const todayCost = todaySales.reduce(
    (acc: number, s: { total: unknown; items: { costPrice: unknown; quantity: number }[] }) =>
      acc +
      s.items.reduce(
        (ia: number, i: { costPrice: unknown; quantity: number }) =>
          ia + Number(i.costPrice) * i.quantity,
        0
      ),
    0
  )
  const todayProfit = todayTotal - todayCost
  const yesterdayTotal = yesterdaySales.reduce(
    (acc: number, s: { total: unknown }) => acc + Number(s.total),
    0
  )

  const revenueChange =
    yesterdayTotal > 0
      ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
      : null

  return {
    todayTotal,
    todayCount: todaySales.length,
    todayProfit,
    revenueChange,
    lowStockProducts,
  }
}

async function getWeeklySales(tenantId: string) {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 6)
  weekAgo.setHours(0, 0, 0, 0)

  const sales = await db.sale.findMany({
    where: {
      tenantId,
      status: "COMPLETED",
      createdAt: { gte: weekAgo, lte: today },
    },
    select: { total: true, createdAt: true },
  })

  // Build a map date → { total, count }
  const map: Record<string, { total: number; count: number }> = {}
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekAgo)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    map[key] = { total: 0, count: 0 }
  }

  for (const s of sales) {
    const key = s.createdAt.toISOString().slice(0, 10)
    if (map[key]) {
      map[key].total += Number(s.total)
      map[key].count += 1
    }
  }

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))
}

async function getLowStockCount(tenantId: string): Promise<number> {
  try {
    const products = await db.product.findMany({
      where: { tenantId, active: true },
      select: { stock: true, minStock: true },
    })
    return products.filter((p: { stock: number; minStock: number }) => p.stock <= p.minStock).length
  } catch {
    return 0
  }
}

async function getAIResumen(tenantId: string): Promise<string | null> {
  try {
    const baseUrl =
      process.env.NEXTAUTH_URL ?? "http://localhost:3000"
    const res = await fetch(
      `${baseUrl}/api/ia/resumen-dia?tenantId=${tenantId}`,
      {
        cache: "no-store",
        headers: { "x-internal-call": "1" },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return (data as { resumen?: string }).resumen ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function QuickActions() {
  const actions = [
    {
      href: "/pos",
      label: "Nueva venta",
      icon: ShoppingCart,
      color: "bg-purple-600 hover:bg-purple-700",
    },
    {
      href: "/caja",
      label: "Abrir caja",
      icon: DollarSign,
      color: "bg-emerald-700 hover:bg-emerald-600",
    },
    {
      href: "/cargas",
      label: "Registrar carga",
      icon: Truck,
      color: "bg-blue-700 hover:bg-blue-600",
    },
    {
      href: "/gastos",
      label: "Cargar gasto",
      icon: TrendingDown,
      color: "bg-amber-700 hover:bg-amber-600",
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {actions.map(({ href, label, icon: Icon, color }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] ${color}`}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </div>
  )
}

function LowStockAlert({
  products,
}: {
  products: { id: string; name: string; stock: number; minStock: number }[]
}) {
  if (!products.length) return null
  return (
    <div className="card-glow rounded-xl p-5 border-l-2 border-l-amber-500/60">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">
            Stock bajo · {products.length} producto{products.length > 1 ? "s" : ""}
          </h3>
          <p className="text-xs text-gray-500">Necesitan reposición pronto</p>
        </div>
        <Link
          href="/inventario?filter=lowstock"
          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 flex-shrink-0"
        >
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <ul className="space-y-3">
        {products.slice(0, 5).map((p) => {
          // Proporción: 0 stock = 0%, stock=minStock = 100%
          const pct = p.minStock > 0
            ? Math.min(100, Math.round((p.stock / p.minStock) * 100))
            : 0
          const tone = pct < 25 ? "danger" : pct < 60 ? "warning" : "brand"
          return (
            <li key={p.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs gap-3">
                <span className="text-gray-200 truncate font-medium">{p.name}</span>
                <span className={`font-mono tabular-nums flex-shrink-0 ${
                  tone === "danger" ? "text-red-400" :
                  tone === "warning" ? "text-amber-400" :
                  "text-gray-300"
                }`}>
                  {p.stock} / {p.minStock}
                </span>
              </div>
              <Progress value={pct} tone={tone} className="h-1.5" />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AIResumenSection({ resumen }: { resumen: string | null }) {
  return (
    <div className="card-glow rounded-xl p-5 relative overflow-hidden">
      {/* Glow decorativo en el fondo */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-40 pointer-events-none"
        style={{ background: "color-mix(in oklab, var(--color-accent) 50%, transparent)" }}
        aria-hidden
      />
      <div className="flex items-center gap-2 mb-3 relative">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "color-mix(in oklab, var(--color-accent) 20%, transparent)", border: "1px solid color-mix(in oklab, var(--color-accent) 40%, transparent)" }}
        >
          <Sparkles className="w-4 h-4 text-accent" />
        </div>
        <h2 className="text-sm font-semibold text-gray-100">Resumen IA del día</h2>
        <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Actualizado hoy
        </span>
      </div>
      {resumen ? (
        <p className="text-sm text-gray-300 leading-relaxed relative">{resumen}</p>
      ) : (
        <p className="text-sm text-gray-500 italic relative">
          No hay suficiente información para generar un resumen. Realizá tu primera
          venta del día para activar el análisis automático.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const tenantId = session.user.tenantId
  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 text-sm">Sin tenant asignado. Contactá soporte.</p>
      </div>
    )
  }

  const [stats, weeklyData, lowStockCount, aiResumen] = await Promise.all([
    getTodayStats(tenantId),
    getWeeklySales(tenantId),
    getLowStockCount(tenantId),
    getAIResumen(tenantId),
  ])

  const { todayTotal, todayCount, todayProfit, revenueChange, lowStockProducts } =
    stats

  const avgTicket = todayCount > 0 ? todayTotal / todayCount : 0

  // Series de sparkline derivadas de weeklyData
  const revenueTrend = weeklyData.map((d) => d.total)
  const countTrend = weeklyData.map((d) => d.count)

  return (
    <AnimatedStagger className="max-w-7xl mx-auto space-y-6">
      {/* Greeting */}
      <AnimatedItem>
        <h1 className="text-xl font-bold text-gray-100">
          Buen día, {session.user.name?.split(" ")[0] ?? "usuario"} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </AnimatedItem>

      {/* Onboarding checklist — only shows if tenant hasn't dismissed it */}
      <AnimatedItem>
        <OnboardingChecklist />
      </AnimatedItem>

      {/* Low stock alert (full-width if present) */}
      {lowStockProducts.length > 0 && (
        <AnimatedItem>
          <LowStockAlert products={lowStockProducts} />
        </AnimatedItem>
      )}

      {/* Stat cards */}
      <AnimatedItem className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ventas del día"
          value={formatCurrency(todayTotal)}
          icon={Receipt}
          iconColor="text-accent"
          iconBg="bg-accent-soft border border-accent/20"
          change={revenueChange ?? undefined}
          changeLabel="vs ayer"
          sparkline={revenueTrend}
          sparklineColor="text-accent"
        />
        <StatCard
          title="Transacciones"
          value={todayCount}
          icon={ShoppingCart}
          iconColor="text-blue-400"
          iconBg="bg-blue-900/40"
          subtitle={todayCount > 0 ? `Ticket prom: ${formatCurrency(avgTicket)}` : undefined}
          sparkline={countTrend}
          sparklineColor="text-blue-400"
        />
        <StatCard
          title="Ganancias hoy"
          value={formatCurrency(todayProfit)}
          icon={TrendingUp}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-900/40"
          subtitle={
            todayTotal > 0
              ? `Margen: ${((todayProfit / todayTotal) * 100).toFixed(1)}%`
              : undefined
          }
          sparkline={revenueTrend}
          sparklineColor="text-emerald-400"
        />
        <StatCard
          title="Stock bajo"
          value={lowStockCount}
          icon={Package}
          iconColor={lowStockCount > 0 ? "text-amber-400" : "text-gray-400"}
          iconBg={lowStockCount > 0 ? "bg-amber-900/40" : "bg-gray-800"}
          subtitle={lowStockCount > 0 ? "productos por reponer" : "Todo en orden"}
        />
      </AnimatedItem>

      {/* Main content grid */}
      <AnimatedItem className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Weekly chart – takes 2 cols */}
        <div className="lg:col-span-2 card-glow rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-100">
              Ventas últimos 7 días
            </h2>
            <Link
              href="/reportes"
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              Ver reportes <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <Suspense
            fallback={
              <div className="h-[220px] bg-gray-800 animate-pulse rounded-lg" />
            }
          >
            <WeeklySalesChart data={weeklyData} />
          </Suspense>
        </div>

        {/* Quick actions – 1 col */}
        <div className="card-glow rounded-xl p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-gray-100 mb-4">
            Acciones rápidas
          </h2>
          <div className="flex flex-col gap-2 flex-1">
            {[
              { href: "/pos", label: "Nueva venta", icon: ShoppingCart, primary: true },
              { href: "/caja", label: "Gestionar caja", icon: DollarSign, tone: "emerald" },
              { href: "/cargas", label: "Registrar carga", icon: Truck, tone: "sky" },
              { href: "/gastos", label: "Cargar gasto", icon: TrendingDown, tone: "amber" },
              { href: "/inventario", label: "Ver inventario", icon: Package, tone: "slate" },
            ].map(({ href, label, icon: Icon, primary, tone }) => {
              // Primera acción = accent del tenant (destacada).
              // Las otras mantienen tonos semánticos para diferenciarlas a primera vista.
              const isPrimary = !!primary
              const toneClass = (() => {
                if (isPrimary) return "bg-accent hover:bg-accent-hover text-accent-foreground brand-glow"
                if (tone === "emerald") return "bg-emerald-600/90 hover:bg-emerald-500 text-white"
                if (tone === "sky") return "bg-sky-600/90 hover:bg-sky-500 text-white"
                if (tone === "amber") return "bg-amber-600/90 hover:bg-amber-500 text-white"
                return "bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
              })()
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] ${toneClass} group`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{label}</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                </Link>
              )
            })}
          </div>
        </div>
      </AnimatedItem>

      {/* AI Summary */}
      <AnimatedItem>
        <AIResumenSection resumen={aiResumen} />
      </AnimatedItem>
    </AnimatedStagger>
  )
}
