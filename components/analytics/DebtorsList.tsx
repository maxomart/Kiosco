"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DebtorAlert } from "@/types"
import { AlertTriangle, MessageCircle } from "lucide-react"
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
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> CRÍTICO
          </Badge>
        )
      case "WARNING":
        return <Badge className="bg-yellow-100 text-yellow-800">ALERTA</Badge>
      default:
        return <Badge variant="outline">Normal</Badge>
    }
  }

  if (debtors.length === 0) {
    return (
      <Card className="p-8 text-center">
        <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">
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

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Debe</TableHead>
              <TableHead className="text-right">Días vencidos</TableHead>
              <TableHead className="text-right">Última venta</TableHead>
              <TableHead className="w-24">Estado</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debtors.map((debtor) => (
              <TableRow key={debtor.clientId}>
                <TableCell className="font-medium">
                  {debtor.clientName}
                </TableCell>
                <TableCell className="text-right font-semibold text-orange-600">
                  ${debtor.totalOwed.toLocaleString("es-AR")}
                </TableCell>
                <TableCell className="text-right">
                  {debtor.daysOverdue} días
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {debtor.lastSaleDate
                    ? format(
                        new Date(debtor.lastSaleDate),
                        "dd MMM yyyy",
                        { locale: es }
                      )
                    : "Sin ventas"}
                </TableCell>
                <TableCell>{getAlertBadge(debtor.alertLevel)}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled
                  >
                    <MessageCircle className="w-3 h-3" />
                    Recordar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground italic">
        El botón "Recordar" enviará un mensaje por WhatsApp cuando esté habilitado
      </p>
    </div>
  )
}
