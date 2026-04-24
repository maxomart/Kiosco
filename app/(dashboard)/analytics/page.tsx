import { auth } from "@/app/api/auth/[...nextauth]/auth"
import { notFound, redirect } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { calculateProductMargins } from "@/lib/analytics/margins"
import { predictStockLevels } from "@/lib/analytics/stock"
import { detectInvisibleLosses, getTotalLossesByType } from "@/lib/analytics/losses"
import { getDebtorAlerts } from "@/lib/analytics/debtors"
import { MarginCard } from "@/components/analytics/MarginCard"
import { StockWarningList } from "@/components/analytics/StockWarningList"
import { InvisibleLossesList } from "@/components/analytics/InvisibleLossesList"
import { DebtorsList } from "@/components/analytics/DebtorsList"
import {
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Users,
} from "lucide-react"

export const metadata = {
  title: "Analytics - Kiosco",
}

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    redirect("/login")
  }

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

  // KPI Cards
  const marginsByHealth = margins.reduce(
    (acc, p) => {
      acc[p.healthStatus] = (acc[p.healthStatus] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const criticalStock = stocks.filter((s) => s.urgency === "CRITICAL").length
  const avgMargin = margins.length > 0
    ? Math.round((margins.reduce((sum, p) => sum + p.currentMarginPct, 0) / margins.length) * 10) / 10
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Análisis de Negocio</h1>
        <p className="text-muted-foreground mt-1">
          Márgenes, stock, pérdidas invisibles y deudores
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Margen promedio</p>
              <p className="text-2xl font-bold mt-1">{avgMargin.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-2">
                En {margins.length} productos
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Stock crítico</p>
              <p className="text-2xl font-bold mt-1 text-red-600">
                {criticalStock}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Productos por agotar
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pérdidas invisibles</p>
              <p className="text-2xl font-bold mt-1 text-orange-600">
                ${totalLosses.toLocaleString("es-AR")}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Este mes
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-orange-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Por cobrar</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">
                ${totalOwed.toLocaleString("es-AR")}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                De {debtors.length} cliente{debtors.length > 1 ? "s" : ""}
              </p>
            </div>
            <Users className="w-8 h-8 text-amber-600 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="margins" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="margins">Márgenes</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="losses">Pérdidas</TabsTrigger>
          <TabsTrigger value="debtors">Deudores</TabsTrigger>
        </TabsList>

        {/* Tab: Márgenes */}
        <TabsContent value="margins" className="space-y-4 mt-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Análisis de Márgenes</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Visualiza el margen de ganancia de cada producto y detecta oportunidades
              de mejora. Los productos en rojo son candidatos para aumentar precio.
            </p>
          </div>

          {margins.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Sin datos de márgenes aún. Realiza algunas ventas primero.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {margins.map((product) => (
                <MarginCard key={product.productId} product={product} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Stock */}
        <TabsContent value="stock" className="space-y-4 mt-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Stock Inteligente</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Predicción automática de cuándo se agota cada producto basado en
              historial de ventas. Planifica compras con anticipación.
            </p>
          </div>

          {stocks.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Stock en niveles normales para todos los productos
              </p>
            </Card>
          ) : (
            <StockWarningList predictions={stocks} />
          )}
        </TabsContent>

        {/* Tab: Pérdidas */}
        <TabsContent value="losses" className="space-y-4 mt-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Pérdidas Invisibles</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Dinero que se escapa: vencimientos, diferencias de caja y daños.
              Estos números NO están en tus reportes pero afectan las ganancias.
            </p>
          </div>

          {losses.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Sin pérdidas detectadas en este período
              </p>
            </Card>
          ) : (
            <InvisibleLossesList losses={losses} />
          )}
        </TabsContent>

        {/* Tab: Deudores */}
        <TabsContent value="debtors" className="space-y-4 mt-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Clientes Deudores</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Seguimiento de créditos otorgados. Dinero que salió pero no volvió aún.
              Cobra rápido para mejorar el flujo de caja.
            </p>
          </div>

          {debtors.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                ¡Excelente! No hay deudores pendientes
              </p>
            </Card>
          ) : (
            <DebtorsList debtors={debtors} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
