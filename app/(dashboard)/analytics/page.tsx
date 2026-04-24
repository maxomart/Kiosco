import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { calculateMarginsSummary } from "@/lib/analytics/margins"
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
    const [marginsSummary, stocks, losses, debtors] = await Promise.all([
      calculateMarginsSummary(tenantId, 30),
      predictStockLevels(tenantId, 30),
      detectInvisibleLosses(tenantId, 30),
      getDebtorAlerts(tenantId, 0),
    ])

    const { topAttention: margins, deadCount, totalProducts, avgMarginActive } =
      marginsSummary

    const lossTypes = getTotalLossesByType(losses)
    const totalLosses = Object.values(lossTypes).reduce((a, b) => a + b, 0)
    const totalOwed = debtors.reduce((sum, d) => sum + d.totalOwed, 0)
    const criticalStock = stocks.filter((s) => s.urgency === "CRITICAL").length

    return (
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-100">
            Análisis de Negocio
          </h1>
          <p className="text-gray-400 mt-1">
            Ganá más plata sin trabajar más. Estos números te dicen qué hacer.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="md">
            <p className="text-sm text-gray-400">Margen promedio</p>
            <p className="text-2xl font-bold mt-2 text-sky-400">
              {avgMarginActive.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Productos que venden
            </p>
          </Card>

          <Card padding="md">
            <p className="text-sm text-gray-400">Stock crítico</p>
            <p className="text-2xl font-bold mt-2 text-red-400">
              {criticalStock}
            </p>
            <p className="text-xs text-gray-500 mt-2">Se agotan en &lt;3 días</p>
          </Card>

          <Card padding="md">
            <p className="text-sm text-gray-400">Pérdidas invisibles</p>
            <p className="text-2xl font-bold mt-2 text-orange-400">
              ${totalLosses.toLocaleString("es-AR")}
            </p>
            <p className="text-xs text-gray-500 mt-2">Este mes</p>
          </Card>

          <Card padding="md">
            <p className="text-sm text-gray-400">Por cobrar</p>
            <p className="text-2xl font-bold mt-2 text-amber-400">
              ${totalOwed.toLocaleString("es-AR")}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              De {debtors.length} cliente{debtors.length !== 1 ? "s" : ""}
            </p>
          </Card>
        </div>

        {/* Márgenes */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">
              Análisis de Márgenes
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Cuánto ganás por producto. <strong className="text-gray-300">LOW</strong> = subí
              el precio (gana poco).{" "}
              <strong className="text-gray-300">HIGH</strong> = está bien.{" "}
              <strong className="text-gray-300">DEAD</strong> = no se vende, considerá liquidar.
            </p>
          </div>

          {/* Leyenda */}
          <Card padding="sm">
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">
                  HIGH
                </span>
                <span className="text-gray-400">Margen &gt;20% + buena rotación</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/50">
                  MEDIUM
                </span>
                <span className="text-gray-400">Margen ok, rotación media</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-orange-900/40 text-orange-300 border border-orange-700/50">
                  LOW
                </span>
                <span className="text-gray-400">Margen bajo o rota poco</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-red-900/40 text-red-300 border border-red-700/50">
                  DEAD
                </span>
                <span className="text-gray-400">No se vende</span>
              </div>
            </div>
          </Card>

          {margins.length === 0 ? (
            <Card padding="lg">
              <p className="text-gray-400 text-center">
                Sin ventas en 30 días. Realizá algunas ventas para ver análisis.
              </p>
            </Card>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Mostrando top {margins.length} productos que necesitan atención (de{" "}
                {totalProducts} totales)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {margins.map((product) => (
                  <MarginCard key={product.productId} product={product} />
                ))}
              </div>
            </>
          )}

          {/* Productos muertos (colapsado/resumen) */}
          {deadCount > 0 && (
            <Card padding="md">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-semibold text-gray-200">
                    {deadCount} producto{deadCount !== 1 ? "s" : ""} sin ventas
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    No se vendieron en los últimos 30 días. Capital inmovilizado.
                    Considerá liquidar o dejar de reabastecer.
                  </p>
                </div>
                <a
                  href="/inventario"
                  className="text-sm text-sky-400 hover:text-sky-300 whitespace-nowrap"
                >
                  Ver en inventario →
                </a>
              </div>
            </Card>
          )}
        </section>

        {/* Stock Inteligente */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">
              Stock Inteligente
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Te dice <strong className="text-gray-300">cuándo se va a agotar</strong> cada
              producto según lo que vendiste. Así no te quedás sin lo que más sale.
            </p>
          </div>

          {stocks.length === 0 ? (
            <Card padding="lg">
              <p className="text-gray-400 text-center">
                ✓ Stock en niveles normales para todos los productos
              </p>
            </Card>
          ) : (
            <StockWarningList predictions={stocks} />
          )}
        </section>

        {/* Pérdidas Invisibles */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">
              Pérdidas Invisibles
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Dinero que se escapa <strong className="text-gray-300">sin que te des cuenta</strong>:
              diferencias de caja, productos vencidos, daños. No está en tus reportes pero
              afecta tus ganancias.
            </p>
          </div>

          {losses.length === 0 ? (
            <Card padding="lg">
              <p className="text-gray-400 text-center">
                ✓ Sin pérdidas detectadas en este período
              </p>
            </Card>
          ) : (
            <InvisibleLossesList losses={losses} />
          )}
        </section>

        {/* Deudores */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">
              Clientes Deudores
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Plata que te deben y no pagaron. <strong className="text-gray-300">Cobrá rápido</strong>,
              no dejes que se acumule. A los +60 días baja mucho la chance de cobrar.
            </p>
          </div>

          {debtors.length === 0 ? (
            <Card padding="lg">
              <p className="text-gray-400 text-center">
                ✓ Sin deudores pendientes
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
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-100">Analytics</h1>
        <Card padding="lg">
          <p className="text-red-400 font-semibold">Error cargando analytics:</p>
          <p className="text-gray-400 mt-2 text-sm">
            {error instanceof Error ? error.message : "Error desconocido"}
          </p>
        </Card>
      </div>
    )
  }
}
