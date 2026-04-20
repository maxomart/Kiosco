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
    <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <h3 className="text-sm font-semibold text-amber-300">
          Stock bajo ({products.length} producto{products.length > 1 ? "s" : ""})
        </h3>
        <Link
          href="/inventario?filter=lowstock"
          className="ml-auto text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
        >
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <ul className="space-y-1.5">
        {products.slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-center justify-between text-xs">
            <span className="text-gray-300 truncate max-w-[70%]">{p.name}</span>
            <span className="text-amber-400 font-medium tabular-nums">
              {p.stock} / min {p.minStock}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AIResumenSection({ resumen }: { resumen: string | null }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-purple-900/60 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        </div>
        <h2 className="text-sm font-semibold text-gray-100">Resumen IA del día</h2>
        <span className="ml-auto text-xs text-gray-600 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Actualizado hoy
        </span>
      </div>
      {resumen ? (
        <p className="text-sm text-gray-300 leading-relaxed">{resumen}</p>
      ) : (
        <p className="text-sm text-gray-500 italic">
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
          iconColor="text-purple-400"
          iconBg="bg-purple-900/40"
          change={revenueChange ?? undefined}
          changeLabel="vs ayer"
        />
        <StatCard
          title="Transacciones"
          value={todayCount}
          icon={ShoppingCart}
          iconColor="text-blue-400"
          iconBg="bg-blue-900/40"
          subtitle={todayCount > 0 ? `Ticket prom: ${formatCurrency(avgTicket)}` : undefined}
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
      <AnimatedItem className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly chart – takes 2 cols */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
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
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-100 mb-4">
            Acciones rápidas
          </h2>
          <div className="flex flex-col gap-2">
            {[
              { href: "/pos", label: "Nueva venta", icon: ShoppingCart, color: "bg-purple-600 hover:bg-purple-700" },
              { href: "/caja", label: "Gestionar caja", icon: DollarSign, color: "bg-emerald-700 hover:bg-emerald-600" },
              { href: "/cargas", label: "Registrar carga", icon: Truck, color: "bg-blue-700 hover:bg-blue-600" },
              { href: "/gastos", label: "Cargar gasto", icon: TrendingDown, color: "bg-amber-700 hover:bg-amber-600" },
              { href: "/inventario", label: "Ver inventario", icon: Package, color: "bg-gray-700 hover:bg-gray-600" },
            ].map(({ href, label, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-all duration-150 ${color}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-50" />
              </Link>
            ))}
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
