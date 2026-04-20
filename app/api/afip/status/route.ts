import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

/**
 * GET /api/afip/status
 * Returns the tenant's AFIP config + last-sync status for the dashboard header.
 */
export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const cfg = await db.tenantConfig.findUnique({ where: { tenantId: tenantId! } })
  if (!cfg) return NextResponse.json({ enabled: false })

  return NextResponse.json({
    enabled: cfg.afipEnabled,
    mode: cfg.afipMode,
    condicionIVA: cfg.afipCondicionIVA,
    pointOfSale: cfg.afipPointOfSale,
    provider: cfg.afipCertProvider,
    cuit: cfg.afipCertCuit,
    hasSecret: !!cfg.afipCertSecret,
    lastSyncAt: cfg.afipLastSyncAt,
    lastError: cfg.afipLastError,
  })
}
