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
        return "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50"
      case "MEDIUM":
        return "bg-amber-900/40 text-amber-300 border border-amber-700/50"
      case "LOW":
        return "bg-orange-900/40 text-orange-300 border border-orange-700/50"
      case "DEAD":
        return "bg-red-900/40 text-red-300 border border-red-700/50"
      default:
        return "bg-gray-800 text-gray-400 border border-gray-700"
    }
  }

  const getMarginColor = (margin: number) => {
    if (margin >= 25) return "text-emerald-400"
    if (margin >= 15) return "text-amber-400"
    return "text-red-400"
  }

  const potentialGain =
    product.potentialMarginPct - product.currentMarginPct

  return (
    <Card padding="md">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate text-gray-100">
            {product.productName}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Stock: {product.currentStock} | {product.avgDailySales}/día
          </p>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${getHealthColor(
            product.healthStatus
          )}`}
        >
          {product.healthStatus}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">Margen actual</p>
          <p
            className={`text-lg font-bold ${getMarginColor(
              product.currentMarginPct
            )}`}
          >
            {product.currentMarginPct.toFixed(1)}%
          </p>
        </div>

        {potentialGain > 0 && (
          <div className="bg-sky-900/30 border border-sky-700/40 rounded p-2">
            <p className="text-xs text-gray-400 mb-1">Posible</p>
            <p className="text-sm font-semibold text-sky-300">
              +{potentialGain.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {product.daysToStockout < 30 && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <span className="text-orange-400 font-medium text-xs">
            Se agota en {product.daysToStockout} días
          </span>
        </div>
      )}
    </Card>
  )
}
