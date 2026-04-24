import { db } from "@/lib/db"
import type { DebtorAlert } from "@/types"
import { differenceInDays } from "date-fns"

export async function getDebtorAlerts(
  tenantId: string,
  overdueDays: 0 | 30 | 60 = 0
): Promise<DebtorAlert[]> {
  // Get clients with debt (currentBalance > 0)
  const debtors = await db.client.findMany({
    where: {
      tenantId,
      currentBalance: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      currentBalance: true,
      sales: {
        where: { status: "COMPLETED" },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  const alerts: DebtorAlert[] = []
  const now = new Date()

  for (const debtor of debtors) {
    const lastSale =
      debtor.sales.length > 0 ? debtor.sales[0].createdAt : null
    const daysOverdue = lastSale
      ? differenceInDays(now, lastSale)
      : 999

    // Filter by overdueDays threshold
    if (overdueDays > 0 && daysOverdue < overdueDays) {
      continue
    }

    // Determine alert level
    let alertLevel: "CRITICAL" | "WARNING" | "NORMAL"
    if (daysOverdue >= 60 || Number(debtor.currentBalance) > 10000) {
      alertLevel = "CRITICAL"
    } else if (daysOverdue >= 30 || Number(debtor.currentBalance) > 5000) {
      alertLevel = "WARNING"
    } else {
      alertLevel = "NORMAL"
    }

    alerts.push({
      clientId: debtor.id,
      clientName: debtor.name,
      totalOwed: Number(debtor.currentBalance),
      daysOverdue,
      lastSaleDate: lastSale?.toISOString() || null,
      alertLevel,
    })
  }

  // Sort: CRITICAL first, then by amount owed
  return alerts.sort((a, b) => {
    const levelOrder = { CRITICAL: 0, WARNING: 1, NORMAL: 2 }
    const levelDiff = levelOrder[a.alertLevel] - levelOrder[b.alertLevel]
    if (levelDiff !== 0) return levelDiff
    return b.totalOwed - a.totalOwed
  })
}
