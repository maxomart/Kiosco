"use client"

import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import type { ProductMarginAnalysis } from "@/types"

interface MarginCardProps {
  product: ProductMarginAnalysis
}

export function MarginCard({ product }: MarginCardProps) {
  const getHealthColor = (status: string) => {
    switch (status) {
      case "HIGH":
        return "bg-green-100 text-green-800"
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800"
      case "LOW":
        return "bg-orange-100 text-orange-800"
      case "DEAD":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getMarginColor = (margin: number) => {
    if (margin >= 25) return "text-green-600"
    if (margin >= 15) return "text-yellow-600"
    return "text-red-600"
  }

  const potentialGain =
    product.potentialMarginPct - product.currentMarginPct

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-sm truncate">
            {product.productName}
          </h3>
          <p className="text-xs text-gray-500">
            Stock: {product.currentStock} | {product.avgDailySales}/día
          </p>
        </div>
        <Badge className={getHealthColor(product.healthStatus)}>
          {product.healthStatus}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">Margen actual</p>
          <p className={`text-lg font-bold ${getMarginColor(product.currentMarginPct)}`}>
            {product.currentMarginPct.toFixed(1)}%
          </p>
        </div>

        {potentialGain > 0 && (
          <div className="bg-blue-50 rounded p-2">
            <p className="text-xs text-gray-500 mb-1">Posible</p>
            <p className="text-sm font-semibold text-blue-600">
              +{potentialGain.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {product.daysToStockout < 30 && (
        <div className="mt-3 pt-3 border-t border-dashed">
          <span className="text-orange-600 font-medium text-xs">
            Se agota en {product.daysToStockout} días
          </span>
        </div>
      )}
    </Card>
  )
}
