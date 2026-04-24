import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { can, hasFeature } from "@/lib/permissions"
import { PaywallGate } from "@/components/shared/PaywallGate"
import { NoAccess } from "@/components/shared/NoAccess"
import type { Plan } from "@/lib/utils"
import StatCard from "@/components/shared/StatCard"
import { Card } from "@/components/ui/Card"
import {
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Users,
  PackageX,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { calculateMarginsSummary } from "@/lib/analytics/margins"
import { predictStockLevels } from "@/lib/analytics/stock"
import {
  detectInvisibleLosses,
  getTotalLossesByType,
} from "@/lib/analytics/losses"
import { getDebtorAlerts } from "@/lib/analytics/debtors"
import { MarginCard } from "@/components/analytics/MarginCard"
import { StockWarningList } from "@/components/analytics/StockWarningList"
import { InvisibleLossesList } from "@/components/analytics/InvisibleLossesList"
import { DebtorsList } from "@/components/analytics/DebtorsList"

export const metadata = {
  title: "Analytics - Kiosco",
}

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const role = session.user.role
  const tenantId = session.user.tenantId

  if (!can(role, "reports:read")) {
    return <NoAccess />
  }

  let plan: Plan = "STARTER"
  if (tenantId) {
    const sub = await db.subscription.findUnique({
      where: { tenantId },
      select: { plan: true },
    })
    plan = (sub?.plan as Plan) ?? "STARTER"
  }

  if (!hasFeature(plan, "feature:analytics")) {
    return (
      <PaywallGate
        currentPlan={plan}
        requiredPlan="PROFESSIONAL"
        title="Análisis Inteligente de Negocio"
        description="Descubrí dónde se pierde plata y qué hacer para ganar más. Análisis que transforma datos en acciones concretas."
        perks={[
          "Márgenes por producto — sabé qué sube de precio sin afectar ventas",
          "Predicción de stock — nunca te quedes sin lo que más vende",
          "Pérdidas invisibles — detectá vencimientos y diferencias de caja",
          "Alertas de deudores — cobrá antes de que se convierta en incobrable",
        ]}
      />
    )
  }

  if (!tenantId) return <NoAccess />

  try {
    const [marginsSummary, stocks, losses, debtors] = await Promise.all([
      calculateMarginsSummary(tenantId, 30),
      predictStockLevels(tenantId, 30),
      detectInvisibleLosses(tenantId, 30),
      getDebtorAlerts(tenantId, 0),
    ])

    const {
      topAttention: margins,
      deadCount,
      totalProducts,
      avgMarginActive,
    } = marginsSummary

    const lossTypes = getTotalLossesByType(losses)
    const totalLosses = Object.values(lossTypes).reduce((a, b) => a + b, 0)
    const totalOwed = debtors.reduce((sum, d) => sum + d.totalOwed, 0)
    const criticalStock = stocks.filter((s) => s.urgency === "CRITICAL").length
    const criticalDebtors = debtors.filter(
      (d) => d.alertLevel === "CRITICAL"
    ).length

    const hasAnyIssue =
      criticalStock > 0 ||
      totalLosses > 0 ||
      totalOwed > 0 ||
      margins.some((m) => m.healthStatus === "LOW")

    return (
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-soft border border-accent/30 text-accent text-xs font-medium">
                <Sparkles className="w-3 h-3" />
                Analytics Inteligente
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-100">
              Análisis de Negocio
            </h1>
            <p className="text-gray-400 mt-1">
              Ganá más sin trabajar más. Estos números te dicen qué hacer.
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Margen promedio"
            value={`${avgMarginActive.toFixed(1)}%`}
            icon={TrendingUp}
            iconColor="text-sky-400"
            iconBg="bg-sky-900/40"
            subtitle={`Productos activos (${totalProducts - deadCount} de ${totalProducts})`}
          />
          <StatCard
            title="Stock crítico"
            value={criticalStock}
            icon={AlertTriangle}
            iconColor={criticalStock > 0 ? "text-red-400" : "text-emerald-400"}
            iconBg={criticalStock > 0 ? "bg-red-900/40" : "bg-emerald-900/40"}
            subtitle={
              criticalStock > 0
                ? "Productos por agotar"
                : "Stock en orden"
            }
          />
          <StatCard
            title="Pérdidas invisibles"
            value={`$${totalLosses.toLocaleString("es-AR")}`}
            icon={PackageX}
            iconColor={totalLosses > 0 ? "text-orange-400" : "text-emerald-400"}
            iconBg={totalLosses > 0 ? "bg-orange-900/40" : "bg-emerald-900/40"}
            subtitle="Este mes"
          />
          <StatCard
            title="Por cobrar"
            value={`$${totalOwed.toLocaleString("es-AR")}`}
            icon={Users}
            iconColor={criticalDebtors > 0 ? "text-red-400" : "text-amber-400"}
            iconBg={criticalDebtors > 0 ? "bg-red-900/40" : "bg-amber-900/40"}
            subtitle={`${debtors.length} cliente${debtors.length !== 1 ? "s" : ""}`}
          />
        </div>

        {/* Resumen general / empty state */}
        {!hasAnyIssue && (
          <Card padding="lg" className="text-center border-emerald-700/40 bg-emerald-900/10">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-100 mb-1">
              Todo en orden
            </h3>
            <p className="text-sm text-gray-400">
              No hay alertas críticas. Seguí vendiendo.
            </p>
          </Card>
        )}

        {/* Márgenes */}
        <section>
          <SectionHeader
            title="Márgenes por Producto"
            description="Cuánto ganás con cada venta. Los LOW pueden rendir más si subís precio; los DEAD no rotan."
            accent={
              margins.filter((m) => m.healthStatus === "LOW").length > 0
                ? `${margins.filter((m) => m.healthStatus === "LOW").length} productos pueden rendir más`
                : null
            }
          />

          {/* Leyenda compacta */}
          <div className="flex flex-wrap gap-2 mb-4">
            <LegendBadge
              color="emerald"
              label="HIGH"
              desc="Margen >20% + rota"
            />
            <LegendBadge
              color="amber"
              label="MEDIUM"
              desc="Rendimiento medio"
            />
            <LegendBadge
              color="orange"
              label="LOW"
              desc="Margen bajo o rota poco"
            />
            <LegendBadge color="red" label="DEAD" desc="Sin ventas" />
          </div>

          {margins.length === 0 ? (
            <Card padding="lg" className="text-center">
              <p className="text-gray-400">
                Sin ventas recientes. Hacé algunas ventas para ver el análisis.
              </p>
            </Card>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Mostrando top {margins.length} que necesitan atención (de{" "}
                {totalProducts} productos)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {margins.map((product) => (
                  <MarginCard key={product.productId} product={product} />
                ))}
              </div>
            </>
          )}

          {deadCount > 0 && (
            <Card padding="md" className="mt-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <PackageX className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-200">
                      {deadCount} producto{deadCount !== 1 ? "s" : ""} sin ventas
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Capital inmovilizado. Liquidá o dejá de reabastecer.
                    </p>
                  </div>
                </div>
                <Link
                  href="/inventario"
                  className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent/80 whitespace-nowrap font-medium"
                >
                  Ver en inventario
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </Card>
          )}
        </section>

        {/* Stock */}
        <section>
          <SectionHeader
            title="Stock Inteligente"
            description="Cuándo se agota cada producto según lo que vendiste. Comprá a tiempo."
            accent={criticalStock > 0 ? `${criticalStock} críticos` : null}
          />
          {stocks.length === 0 ? (
            <Card padding="lg" className="text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-gray-300 font-medium">
                Stock en niveles normales
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Todos los productos tienen stock suficiente
              </p>
            </Card>
          ) : (
            <StockWarningList predictions={stocks} />
          )}
        </section>

        {/* Pérdidas */}
        <section>
          <SectionHeader
            title="Pérdidas Invisibles"
            description="Plata que se escapa sin que te des cuenta. No está en reportes pero afecta ganancias."
            accent={totalLosses > 0 ? `$${totalLosses.toLocaleString("es-AR")} detectados` : null}
          />
          {losses.length === 0 ? (
            <Card padding="lg" className="text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-gray-300 font-medium">
                Sin pérdidas detectadas
              </p>
              <p className="text-xs text-gray-500 mt-1">
                No hay diferencias de caja ni vencimientos
              </p>
            </Card>
          ) : (
            <InvisibleLossesList losses={losses} />
          )}
        </section>

        {/* Deudores */}
        <section>
          <SectionHeader
            title="Clientes Deudores"
            description="Plata que te deben. Cobrá rápido — después de 60 días la chance de cobrar baja mucho."
            accent={
              criticalDebtors > 0
                ? `${criticalDebtors} crítico${criticalDebtors > 1 ? "s" : ""}`
                : null
            }
          />
          {debtors.length === 0 ? (
            <Card padding="lg" className="text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-gray-300 font-medium">Sin deudores</p>
              <p className="text-xs text-gray-500 mt-1">
                Todos tus clientes están al día
              </p>
            </Card>
          ) : (
            <DebtorsList debtors={debtors} />
          )}
        </section>
      </div>
    )
  } catch (error) {
    console.error("[analytics] Error:", error)
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-100">Analytics</h1>
        <Card padding="lg">
          <p className="text-red-400 font-semibold">Error cargando analytics</p>
          <p className="text-gray-400 mt-2 text-sm">
            {error instanceof Error ? error.message : "Error desconocido"}
          </p>
        </Card>
      </div>
    )
  }
}

function SectionHeader({
  title,
  description,
  accent,
}: {
  title: string
  description: string
  accent: string | null
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-xl font-semibold text-gray-100">{title}</h2>
        {accent && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-300 bg-amber-900/30 border border-amber-700/40 px-2 py-0.5 rounded-full">
            <DollarSign className="w-3 h-3" />
            {accent}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  )
}

function LegendBadge({
  color,
  label,
  desc,
}: {
  color: "emerald" | "amber" | "orange" | "red"
  label: string
  desc: string
}) {
  const classes = {
    emerald: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50",
    amber: "bg-amber-900/40 text-amber-300 border-amber-700/50",
    orange: "bg-orange-900/40 text-orange-300 border-orange-700/50",
    red: "bg-red-900/40 text-red-300 border-red-700/50",
  }[color]

  return (
    <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-3 py-1.5">
      <span
        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${classes}`}
      >
        {label}
      </span>
      <span className="text-xs text-gray-400">{desc}</span>
    </div>
  )
}
