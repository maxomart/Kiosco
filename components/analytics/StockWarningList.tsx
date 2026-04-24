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
import type { StockPrediction } from "@/types"
import { AlertTriangle, Zap } from "lucide-react"

interface StockWarningListProps {
  predictions: StockPrediction[]
}

export function StockWarningList({ predictions }: StockWarningListProps) {
  if (predictions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">
          Stock en niveles normales para todos los productos
        </p>
      </Card>
    )
  }

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "CRITICAL":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> CRÍTICO
          </Badge>
        )
      case "HIGH":
        return <Badge className="bg-orange-100 text-orange-800">ALTO</Badge>
      case "NORMAL":
        return <Badge variant="outline">Normal</Badge>
      default:
        return <Badge variant="secondary">Bajo</Badge>
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

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Stock actual</TableHead>
              <TableHead className="text-right">Vende/día</TableHead>
              <TableHead className="text-right">Se agota en</TableHead>
              <TableHead className="text-right">Comprar</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="w-24">Urgencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {predictions.map((p) => (
              <TableRow key={p.productId}>
                <TableCell className="font-medium">{p.productName}</TableCell>
                <TableCell className="text-right">{p.currentStock}</TableCell>
                <TableCell className="text-right">
                  {p.avgDailySales.toFixed(1)}
                </TableCell>
                <TableCell className="text-right">
                  {p.daysUntilStockout} días
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {p.recommendedQuantity}
                </TableCell>
                <TableCell className="text-right">
                  ${p.estimatedCost.toLocaleString("es-AR")}
                </TableCell>
                <TableCell>{getUrgencyBadge(p.urgency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
