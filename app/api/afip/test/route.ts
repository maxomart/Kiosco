import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getAfipProvider } from "@/lib/afip"

/**
 * POST /api/afip/test
 * Runs provider.ping() so the user can validate creds from the settings page.
 */
export async function POST() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error
  const role = session!.user.role
  if (role !== "OWNER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const cfg = await db.tenantConfig.findUnique({ where: { tenantId: tenantId! } })
  if (!cfg) return NextResponse.json({ ok: false, message: "Sin configuración" }, { status: 400 })

  // For testing we always build a provider (even if afipEnabled=false), so the
  // user can validate creds before turning the switch on.
  const provider = getAfipProvider({ ...cfg, afipEnabled: true })
  if (!provider) return NextResponse.json({ ok: false, message: "No se pudo inicializar el proveedor" }, { status: 400 })

  const result = await provider.ping()
  await db.tenantConfig.update({
    where: { tenantId: tenantId! },
    data: { afipLastError: result.ok ? null : result.message },
  })
  return NextResponse.json(result)
}
