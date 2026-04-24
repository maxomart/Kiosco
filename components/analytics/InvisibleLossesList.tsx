"use client"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { InvisibleLoss } from "@/types"
import { AlertCircle, Droplets, Zap } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface InvisibleLossesListProps {
  losses: InvisibleLoss[]
}

export function InvisibleLossesList({ losses }: InvisibleLossesListProps) {
  const total = losses.reduce((sum, loss) => sum + loss.estimatedValue, 0)

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "EXPIRED":
        return <AlertCircle className="w-4 h-4" />
      case "CASH_DIFF":
        return <Droplets className="w-4 h-4" />
      case "DAMAGED":
        return <Zap className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

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
        <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">
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

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {losses.map((loss) => (
              <TableRow key={loss.id}>
                <TableCell>
                  <Badge className={`flex items-center gap-1 w-fit ${getTypeBadgeColor(loss.type)}`}>
                    {getTypeIcon(loss.type)}
                    {getTypeLabel(loss.type)}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {loss.description}
                </TableCell>
                <TableCell className="text-right font-semibold text-red-600">
                  ${loss.estimatedValue.toLocaleString("es-AR")}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {format(new Date(loss.detectedAt), "dd MMM yyyy", {
                    locale: es,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
