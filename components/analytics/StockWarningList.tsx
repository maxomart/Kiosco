"use client"

import { Card } from "@/components/ui/Card"
import type { StockPrediction } from "@/types"

interface StockWarningListProps {
  predictions: StockPrediction[]
}

export function StockWarningList({ predictions }: StockWarningListProps) {
  if (predictions.length === 0) {
    return (
      <Card padding="lg">
        <p className="text-gray-400 text-center">
          Stock en niveles normales para todos los productos
        </p>
      </Card>
    )
  }

  const getUrgencyBadge = (urgency: string) => {
    const base =
      "px-2 py-1 rounded text-xs font-medium whitespace-nowrap"
    switch (urgency) {
      case "CRITICAL":
        return (
          <span
            className={`${base} bg-red-900/40 text-red-300 border border-red-700/50`}
          >
            CRÍTICO
          </span>
        )
      case "HIGH":
        return (
          <span
            className={`${base} bg-orange-900/40 text-orange-300 border border-orange-700/50`}
          >
            ALTO
          </span>
        )
      case "NORMAL":
        return (
          <span
            className={`${base} bg-amber-900/40 text-amber-300 border border-amber-700/50`}
          >
            Normal
          </span>
        )
      default:
        return (
          <span
            className={`${base} bg-gray-800 text-gray-400 border border-gray-700`}
          >
            Bajo
          </span>
        )
    }
  }

  const total = predictions.reduce((sum, p) => sum + p.estimatedCost, 0)

  return (
    <div className="space-y-3">
      <div className="bg-sky-900/30 border border-sky-700/40 rounded-lg p-4">
        <p className="text-sm text-sky-300">
          <strong className="text-sky-200">Costo total de compra sugerida:</strong>{" "}
          ${total.toLocaleString("es-AR")}
        </p>
      </div>

      <div className="space-y-2">
        {predictions.map((p) => (
          <Card key={p.productId} padding="sm">
            <div className="flex justify-between items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-100 truncate">
                  {p.productName}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Stock: {p.currentStock} | Vende: {p.avgDailySales.toFixed(1)}/día
                  | Se agota: {p.daysUntilStockout}d
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-100">
                    Comprar {p.recommendedQuantity}
                  </p>
                  <p className="text-xs text-gray-400">
                    ${p.estimatedCost.toLocaleString("es-AR")}
                  </p>
                </div>
                {getUrgencyBadge(p.urgency)}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
