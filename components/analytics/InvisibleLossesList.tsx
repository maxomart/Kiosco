"use client"

import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import type { InvisibleLoss } from "@/types"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface InvisibleLossesListProps {
  losses: InvisibleLoss[]
}

export function InvisibleLossesList({ losses }: InvisibleLossesListProps) {
  const total = losses.reduce((sum, loss) => sum + loss.estimatedValue, 0)

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "EXPIRED":
        return "Vencido"
      case "CASH_DIFF":
        return "Diferencia Caja"
      case "THEFT":
        return "Robo/Falta"
      case "DAMAGED":
        return "Daño"
      default:
        return type
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "EXPIRED":
        return "bg-red-100 text-red-800"
      case "CASH_DIFF":
        return "bg-yellow-100 text-yellow-800"
      case "DAMAGED":
        return "bg-orange-100 text-orange-800"
      case "THEFT":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (losses.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-500">
          Sin pérdidas detectadas en este período
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-red-900">
          Dinero perdido: ${total.toLocaleString("es-AR")}
        </p>
        <p className="text-xs text-red-700 mt-1">
          Detectado en este período
        </p>
      </div>

      <div className="space-y-2">
        {losses.map((loss) => (
          <div
            key={loss.id}
            className="border rounded-lg p-3 flex justify-between items-center"
          >
            <div className="flex-1">
              <Badge className={getTypeBadgeColor(loss.type)}>
                {getTypeLabel(loss.type)}
              </Badge>
              <p className="font-medium mt-2">{loss.description}</p>
              <p className="text-xs text-gray-500">
                {format(new Date(loss.detectedAt), "dd MMM yyyy", {
                  locale: es,
                })}
              </p>
            </div>
            <p className="font-semibold text-red-600">
              ${loss.estimatedValue.toLocaleString("es-AR")}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
