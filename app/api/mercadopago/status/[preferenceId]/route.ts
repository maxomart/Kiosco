import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getPaymentStatusByReference } from "@/lib/mercadopago"

// GET /api/mercadopago/status/[preferenceId]?ref=<externalReference>
// Polls MP for the latest payment status of an external reference.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ preferenceId: string }> },
) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const { preferenceId } = await params
  const ref = new URL(req.url).searchParams.get("ref") || preferenceId

  const cfg = await db.tenantConfig.findUnique({ where: { tenantId: tenantId! } })
  if (!cfg?.mpAccessToken) {
    return NextResponse.json({ error: "Mercado Pago no configurado" }, { status: 400 })
  }

  try {
    const status = await getPaymentStatusByReference(cfg.mpAccessToken, ref)
    return NextResponse.json({ status: status.status, paymentId: status.paymentId ?? null })
  } catch (e: any) {
    console.error("[GET /api/mercadopago/status]", e)
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 502 })
  }
}
