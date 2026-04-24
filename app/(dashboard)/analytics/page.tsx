import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { calculateProductMargins } from "@/lib/analytics/margins"
import { predictStockLevels } from "@/lib/analytics/stock"
import { detectInvisibleLosses, getTotalLossesByType } from "@/lib/analytics/losses"
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
  if (!session?.user?.tenantId) {
    redirect("/login")
  }

  const tenantId = session.user.tenantId

  try {
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
    const avgMargin =
      margins.length > 0
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
          <Card padding="md">
            <p className="text-sm text-gray-400">Margen promedio</p>
            <p className="text-2xl font-bold mt-2 text-blue-400">{avgMargin.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-2">
              En {margins.length} productos
            </p>
          </Card>

          <Card padding="md">
            <p className="text-sm text-gray-400">Stock crítico</p>
            <p className="text-2xl font-bold mt-2 text-red-500">
              {criticalStock}
            </p>
            <p className="text-xs text-gray-500 mt-2">Productos por agotar</p>
          </Card>

          <Card padding="md">
            <p className="text-sm text-gray-400">Pérdidas invisibles</p>
            <p className="text-2xl font-bold mt-2 text-orange-500">
              ${totalLosses.toLocaleString("es-AR")}
            </p>
            <p className="text-xs text-gray-500 mt-2">Este mes</p>
          </Card>

          <Card padding="md">
            <p className="text-sm text-gray-400">Por cobrar</p>
            <p className="text-2xl font-bold mt-2 text-amber-500">
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
          {margins.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500">Sin datos aún. Realiza algunas ventas.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {margins.map((product) => (
                <MarginCard key={product.productId} product={product} />
              ))}
            </div>
          )}
        </div>

        {/* Stock */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-2">Stock Inteligente</h2>
          {stocks.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500">
                Stock en niveles normales para todos los productos
              </p>
            </Card>
          ) : (
            <StockWarningList predictions={stocks} />
          )}
        </div>

        {/* Pérdidas */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-2">Pérdidas Invisibles</h2>
          {losses.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500">Sin pérdidas en este período</p>
            </Card>
          ) : (
            <InvisibleLossesList losses={losses} />
          )}
        </div>

        {/* Deudores */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-2">Clientes Deudores</h2>
          {debtors.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500">¡Excelente! Sin deudores pendientes</p>
            </Card>
          ) : (
            <DebtorsList debtors={debtors} />
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
          <p className="text-red-600 font-semibold">Error cargando analytics:</p>
          <p className="text-gray-600 mt-2 text-sm">
            {error instanceof Error ? error.message : "Error desconocido"}
          </p>
        </Card>
      </div>
    )
  }
}
