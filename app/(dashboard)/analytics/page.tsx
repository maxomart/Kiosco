import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card } from "@/components/ui/Card"

export const metadata = {
  title: "Analytics - Kiosco",
}

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    redirect("/login")
  }

  try {
    const { calculateProductMargins } = await import("@/lib/analytics/margins")
    const { predictStockLevels } = await import("@/lib/analytics/stock")
    const { detectInvisibleLosses, getTotalLossesByType } = await import(
      "@/lib/analytics/losses"
    )
    const { getDebtorAlerts } = await import("@/lib/analytics/debtors")
    const { MarginCard } = await import("@/components/analytics/MarginCard")
    const { StockWarningList } = await import("@/components/analytics/StockWarningList")
    const { InvisibleLossesList } = await import("@/components/analytics/InvisibleLossesList")
    const { DebtorsList } = await import("@/components/analytics/DebtorsList")

    const tenantId = session.user.tenantId

    // Fetch all data in parallel
    const [margins, stocks, losses, debtors] = await Promise.all([
      calculateProductMargins(tenantId, 30),
      predictStockLevels(tenantId, 30),
      detectInvisibleLosses(tenantId, 30),
      getDebtorAlerts(tenantId, 0),
    ])

    const lossTypes = getTotalLossesByType(losses)
    const totalLosses = Object.values(lossTypes).reduce((a, b) => a + b, 0)
    const totalOwed = debtors.reduce((sum, d) => sum + d.totalOwed, 0)

    const criticalStock = stocks.filter((s) => s.urgency === "CRITICAL").length
    const avgMargin = margins.length > 0
      ? Math.round(
          (margins.reduce((sum, p) => sum + p.currentMarginPct, 0) /
            margins.length) *
            10
        ) / 10
      : 0

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Análisis de Negocio</h1>
          <p className="text-gray-500 mt-1">
            Márgenes, stock, pérdidas invisibles y deudores
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-gray-500">Margen promedio</p>
            <p className="text-2xl font-bold mt-1">{avgMargin.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-2">
              En {margins.length} productos
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-sm text-gray-500">Stock crítico</p>
            <p className="text-2xl font-bold mt-1 text-red-600">
              {criticalStock}
            </p>
            <p className="text-xs text-gray-500 mt-2">Productos por agotar</p>
          </Card>

          <Card className="p-4">
            <p className="text-sm text-gray-500">Pérdidas invisibles</p>
            <p className="text-2xl font-bold mt-1 text-orange-600">
              ${totalLosses.toLocaleString("es-AR")}
            </p>
            <p className="text-xs text-gray-500 mt-2">Este mes</p>
          </Card>

          <Card className="p-4">
            <p className="text-sm text-gray-500">Por cobrar</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">
              ${totalOwed.toLocaleString("es-AR")}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              De {debtors.length} cliente{debtors.length > 1 ? "s" : ""}
            </p>
          </Card>
        </div>

        {/* Márgenes */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-2">Análisis de Márgenes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {margins.slice(0, 6).map((product) => (
              <MarginCard key={product.productId} product={product} />
            ))}
          </div>
          {margins.length === 0 && (
            <Card className="p-4 text-center">
              <p className="text-gray-500">Sin datos aún</p>
            </Card>
          )}
        </div>

        {/* Stock */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-2">Stock Inteligente</h2>
          {stocks.length > 0 ? (
            <StockWarningList predictions={stocks} />
          ) : (
            <Card className="p-4 text-center">
              <p className="text-gray-500">Stock OK en todos</p>
            </Card>
          )}
        </div>

        {/* Pérdidas */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-2">Pérdidas Invisibles</h2>
          {losses.length > 0 ? (
            <InvisibleLossesList losses={losses} />
          ) : (
            <Card className="p-4 text-center">
              <p className="text-gray-500">Sin pérdidas</p>
            </Card>
          )}
        </div>

        {/* Deudores */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-2">Deudores</h2>
          {debtors.length > 0 ? (
            <DebtorsList debtors={debtors} />
          ) : (
            <Card className="p-4 text-center">
              <p className="text-gray-500">Sin deudores</p>
            </Card>
          )}
        </div>
      </div>
    )
  } catch (error) {
    console.error("[analytics] Error:", error)
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <Card className="p-8">
          <p className="text-red-600 font-semibold">
            Error cargando analytics:
          </p>
          <p className="text-gray-600 mt-2">
            {error instanceof Error ? error.message : "Error desconocido"}
          </p>
        </Card>
      </div>
    )
  }
}
