"use client"

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

  const getTypeBadgeClass = (type: string) => {
    const base = "px-2 py-1 rounded text-xs font-medium inline-block"
    switch (type) {
      case "EXPIRED":
        return `${base} bg-red-900/40 text-red-300 border border-red-700/50`
      case "CASH_DIFF":
        return `${base} bg-amber-900/40 text-amber-300 border border-amber-700/50`
      case "DAMAGED":
        return `${base} bg-orange-900/40 text-orange-300 border border-orange-700/50`
      case "THEFT":
        return `${base} bg-red-900/40 text-red-300 border border-red-700/50`
      default:
        return `${base} bg-gray-800 text-gray-400 border border-gray-700`
    }
  }

  if (losses.length === 0) {
    return (
      <Card padding="lg">
        <p className="text-gray-400 text-center">
          Sin pérdidas detectadas en este período
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-4">
        <p className="text-sm font-semibold text-red-300">
          Dinero perdido: ${total.toLocaleString("es-AR")}
        </p>
        <p className="text-xs text-red-400 mt-1">Detectado en este período</p>
      </div>

      <div className="space-y-2">
        {losses.map((loss) => (
          <Card key={loss.id} padding="sm">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <span className={getTypeBadgeClass(loss.type)}>
                  {getTypeLabel(loss.type)}
                </span>
                <p className="font-medium mt-2 text-gray-100">
                  {loss.description}
                </p>
                {loss.detectedAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(loss.detectedAt), "dd MMM yyyy", {
                      locale: es,
                    })}
                  </p>
                )}
              </div>
              <p className="font-semibold text-red-400 whitespace-nowrap">
                ${loss.estimatedValue.toLocaleString("es-AR")}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
