import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

/**
 * Returns the onboarding checklist state, computed from actual DB data.
 * Each step is "done" if there's evidence in the database.
 */
export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error || !tenantId) {
    return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const [config, categoriesCount, productsCount, suppliersCount, salesCount, cashCount] = await Promise.all([
    db.tenantConfig.findUnique({
      where: { tenantId },
      select: { businessName: true, logoUrl: true, onboardingDismissed: true } as any,
    }),
    db.category.count({ where: { tenantId, active: true } }),
    db.product.count({ where: { tenantId, active: true } }),
    db.supplier.count({ where: { tenantId, active: true } }),
    db.sale.count({ where: { tenantId, status: "COMPLETED" } }),
    db.cashSession.count({ where: { tenantId } }),
  ])

  const steps = {
    business: !!(config?.businessName && config.businessName.length > 0),
    categories: categoriesCount > 0,
    products: productsCount > 0,
    suppliers: suppliersCount > 0,
    cashOpened: cashCount > 0,
    firstSale: salesCount > 0,
  }

  const completedCount = Object.values(steps).filter(Boolean).length
  const totalSteps = Object.keys(steps).length
  const progress = Math.round((completedCount / totalSteps) * 100)

  return NextResponse.json({
    dismissed: (config as any)?.onboardingDismissed ?? false,
    steps,
    completedCount,
    totalSteps,
    progress,
    allDone: completedCount === totalSteps,
  })
}
