import { NextResponse } from "next/server"
import { getSessionTenant } from "@/lib/tenant"
import { getInvoiceQuota } from "@/lib/afip-quota"

export const dynamic = "force-dynamic"

/** Devuelve cuántas facturas emitió el tenant este mes y cuántas le quedan. */
export async function GET() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const quota = await getInvoiceQuota(tenantId!)
  return NextResponse.json(quota)
}
