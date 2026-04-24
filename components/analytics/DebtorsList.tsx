"use client"

import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import type { DebtorAlert } from "@/types"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface DebtorsListProps {
  debtors: DebtorAlert[]
}

export function DebtorsList({ debtors }: DebtorsListProps) {
  const total = debtors.reduce((sum, d) => sum + d.totalOwed, 0)

  const getAlertBadge = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return <Badge className="bg-red-600 text-white">CRÍTICO</Badge>
      case "WARNING":
        return <Badge className="bg-yellow-100 text-yellow-800">ALERTA</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Normal</Badge>
    }
  }

  if (debtors.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-500">
          ¡Excelente! No hay deudores pendientes
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-orange-900">
          Dinero por cobrar: ${total.toLocaleString("es-AR")}
        </p>
        <p className="text-xs text-orange-700 mt-1">
          De {debtors.length} cliente{debtors.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="space-y-2">
        {debtors.map((debtor) => (
          <div
            key={debtor.clientId}
            className="border rounded-lg p-3 flex justify-between items-start"
          >
            <div className="flex-1">
              <p className="font-medium">{debtor.clientName}</p>
              <p className="text-xs text-gray-500">
                Vencido: {debtor.daysOverdue} días | Última venta:{" "}
                {debtor.lastSaleDate ? (
                  format(new Date(debtor.lastSaleDate), "dd MMM yyyy", {
                    locale: es,
                  })
                ) : (
                  "Sin ventas"
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="font-semibold text-orange-600">
                  ${debtor.totalOwed.toLocaleString("es-AR")}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {getAlertBadge(debtor.alertLevel)}
                <Button size="sm" variant="outline" disabled className="text-xs">
                  Recordar
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 italic">
        El botón "Recordar" enviará WhatsApp cuando esté habilitado
      </p>
    </div>
  )
}
