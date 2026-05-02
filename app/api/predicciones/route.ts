import { NextResponse } from "next/server"
import { getSessionTenant } from "@/lib/tenant"
import { predictStockouts, getMostProfitable, forecastDayClose } from "@/lib/predictions"
import { requireFeature } from "@/lib/plan-guard"

export const dynamic = "force-dynamic"

/** Stats predictivos para el dashboard del kiosquero. */
export async function GET() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const planErr = await requireFeature(tenantId!, "feature:predictive_ai")
  if (planErr) return planErr

  const [stockouts, profitable, dayClose] = await Promise.all([
    predictStockouts(tenantId!),
    getMostProfitable(tenantId!, 5),
    forecastDayClose(tenantId!),
  ])

  return NextResponse.json({
    stockouts: stockouts.slice(0, 10), // top 10
    profitable,
    dayClose,
  })
}
