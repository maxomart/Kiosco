import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getTenantPlan } from "@/lib/plan-guard"
import { hasFeature } from "@/lib/permissions"

/**
 * GET /api/afip/status
 * Returns the tenant's AFIP config + last-sync status for the dashboard header.
 * Incluye las flags de feature por plan que necesita el frontend para gatear
 * checkboxes / inputs avanzados sin hacer otro round-trip.
 */
export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const cfg = await db.tenantConfig.findUnique({ where: { tenantId: tenantId! } })
  if (!cfg) return NextResponse.json({ enabled: false })

  const plan = await getTenantPlan(tenantId!)

  return NextResponse.json({
    enabled: cfg.afipEnabled,
    ready: cfg.afipReady,
    mode: cfg.afipMode,
    condicionIVA: cfg.afipCondicionIVA,
    pointOfSale: cfg.afipPointOfSale,
    provider: cfg.afipCertProvider,
    cuit: cfg.afipCertCuit,
    hasSecret: !!cfg.afipCertSecret,
    lastSyncAt: cfg.afipLastSyncAt,
    lastError: cfg.afipLastError,
    plan,
    features: {
      invoicing: hasFeature(plan, "feature:afip_invoicing"),
      autoInvoice: hasFeature(plan, "feature:afip_auto_invoice"),
      ncPartial: hasFeature(plan, "feature:afip_nc_partial"),
      ndCustom: hasFeature(plan, "feature:afip_nd_custom"),
      libroIva: hasFeature(plan, "feature:afip_libro_iva"),
    },
  })
}
