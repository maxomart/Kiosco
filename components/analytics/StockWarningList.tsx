"use client"

import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import type { StockPrediction } from "@/types"

interface StockWarningListProps {
  predictions: StockPrediction[]
}

export function StockWarningList({ predictions }: StockWarningListProps) {
  if (predictions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-500">
          Stock en niveles normales para todos los productos
        </p>
      </Card>
    )
  }

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "CRITICAL":
        return <Badge className="bg-red-600 text-white">CRÍTICO</Badge>
      case "HIGH":
        return <Badge className="bg-orange-100 text-orange-800">ALTO</Badge>
      case "NORMAL":
        return <Badge className="bg-yellow-100 text-yellow-800">Normal</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Bajo</Badge>
    }
  }

  const total = predictions.reduce((sum, p) => sum + p.estimatedCost, 0)

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Costo total de compra sugerida:</strong> $
          {total.toLocaleString("es-AR")}
        </p>
      </div>

      <div className="space-y-2">
        {predictions.map((p) => (
          <div
            key={p.productId}
            className="border rounded-lg p-3 flex justify-between items-center"
          >
            <div className="flex-1">
              <p className="font-medium">{p.productName}</p>
              <p className="text-xs text-gray-500">
                Stock: {p.currentStock} | Vende: {p.avgDailySales.toFixed(1)}/día | Se agota: {p.daysUntilStockout}d
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold">Comprar {p.recommendedQuantity}</p>
                <p className="text-xs text-gray-500">
                  ${p.estimatedCost.toLocaleString("es-AR")}
                </p>
              </div>
              {getUrgencyBadge(p.urgency)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
