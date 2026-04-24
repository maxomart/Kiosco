import { db } from "@/lib/db"
import type { InvisibleLoss } from "@/types"
import { subDays } from "date-fns"

export async function detectInvisibleLosses(
  tenantId: string,
  days: 7 | 30 = 30
): Promise<InvisibleLoss[]> {
  const startDate = subDays(new Date(), days)
  const losses: InvisibleLoss[] = []

  // Get ProductLoss records (expired, damaged, theft)
  const productLosses = await db.productLoss.findMany({
    where: {
      tenantId,
      createdAt: { gte: startDate },
    },
    select: {
      id: true,
      type: true,
      estimatedValue: true,
      reason: true,
      createdAt: true,
      product: { select: { name: true } },
    },
  })

  for (const loss of productLosses) {
    losses.push({
      id: loss.id,
      type: loss.type as "EXPIRED" | "DAMAGED" | "THEFT" | "CASH_DIFF",
      amount: 1, // qty is in reason if needed
      description: `${loss.product.name} - ${loss.reason || loss.type}`,
      detectedAt: loss.createdAt.toISOString(),
      estimatedValue: Number(loss.estimatedValue),
    })
  }

  // Get cash register differences
  const cashSessions = await db.cashSession.findMany({
    where: {
      tenantId,
      createdAt: { gte: startDate },
      difference: { not: null },
    },
    select: {
      id: true,
      difference: true,
      createdAt: true,
    },
  })

  for (const session of cashSessions) {
    if (session.difference && Number(session.difference) !== 0) {
      losses.push({
        id: session.id,
        type: "CASH_DIFF",
        amount: Math.abs(Number(session.difference)),
        description:
          Number(session.difference) > 0
            ? `Caja con faltante: $${Math.abs(Number(session.difference))}`
            : `Caja con excedente: $${Math.abs(Number(session.difference))}`,
        detectedAt: session.createdAt.toISOString(),
        estimatedValue: Math.abs(Number(session.difference)),
      })
    }
  }

  // Stock movements marked as LOSS
  const stockMovements = await db.stockMovement.findMany({
    where: {
      type: "LOSS",
      createdAt: { gte: startDate },
      product: { tenantId },
    },
    select: {
      id: true,
      quantity: true,
      totalCost: true,
      reason: true,
      createdAt: true,
      product: { select: { name: true } },
    },
  })

  for (const movement of stockMovements) {
    losses.push({
      id: movement.id,
      type: "DAMAGED",
      amount: movement.quantity,
      description: `${movement.product.name} - ${movement.reason || "Daño/Pérdida"}`,
      detectedAt: movement.createdAt.toISOString(),
      estimatedValue: Number(movement.totalCost || 0),
    })
  }

  return losses.sort(
    (a, b) =>
      new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  )
}

export function getTotalLossesByType(
  losses: InvisibleLoss[]
): Record<string, number> {
  const totals: Record<string, number> = {
    EXPIRED: 0,
    CASH_DIFF: 0,
    THEFT: 0,
    DAMAGED: 0,
  }

  for (const loss of losses) {
    totals[loss.type] = (totals[loss.type] || 0) + loss.estimatedValue
  }

  return totals
}
