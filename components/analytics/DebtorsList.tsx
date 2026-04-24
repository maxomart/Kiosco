"use client"

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
    const base =
      "px-2 py-1 rounded text-xs font-medium whitespace-nowrap"
    switch (level) {
      case "CRITICAL":
        return (
          <span
            className={`${base} bg-red-900/40 text-red-300 border border-red-700/50`}
          >
            CRÍTICO
          </span>
        )
      case "WARNING":
        return (
          <span
            className={`${base} bg-amber-900/40 text-amber-300 border border-amber-700/50`}
          >
            ALERTA
          </span>
        )
      default:
        return (
          <span
            className={`${base} bg-gray-800 text-gray-400 border border-gray-700`}
          >
            Normal
          </span>
        )
    }
  }

  if (debtors.length === 0) {
    return (
      <Card padding="lg">
        <p className="text-gray-400 text-center">
          ¡Excelente! No hay deudores pendientes
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="bg-orange-900/30 border border-orange-700/40 rounded-lg p-4">
        <p className="text-sm font-semibold text-orange-300">
          Dinero por cobrar: ${total.toLocaleString("es-AR")}
        </p>
        <p className="text-xs text-orange-400 mt-1">
          De {debtors.length} cliente{debtors.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="space-y-2">
        {debtors.map((debtor) => (
          <Card key={debtor.clientId} padding="sm">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-100">{debtor.clientName}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Vencido: {debtor.daysOverdue} días | Última venta:{" "}
                  {debtor.lastSaleDate
                    ? format(new Date(debtor.lastSaleDate), "dd MMM yyyy", {
                        locale: es,
                      })
                    : "Sin ventas"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold text-orange-400 whitespace-nowrap">
                  ${debtor.totalOwed.toLocaleString("es-AR")}
                </p>
                <div className="flex flex-col gap-2 items-end">
                  {getAlertBadge(debtor.alertLevel)}
                  <Button size="sm" variant="secondary" disabled className="text-xs">
                    Recordar
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-gray-500 italic">
        El botón "Recordar" enviará WhatsApp cuando esté habilitado
      </p>
    </div>
  )
}
