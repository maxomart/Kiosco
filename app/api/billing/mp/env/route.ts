import { NextResponse } from "next/server"
import { getSessionTenant } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * Devuelve el modo en que está corriendo MercadoPago (test vs production).
 * Detecta por el prefijo del access token:
 *   - TEST-...     → testing (sandbox)
 *   - APP_USR-...  → production
 *   - missing      → no configurado
 *
 * Solo OWNER puede ver esto (no queremos exponer estado de billing al cajero).
 */
export async function GET() {
  const { error, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Solo el dueño puede ver esto" }, { status: 403 })
  }

  const token = process.env.MP_ACCESS_TOKEN ?? ""
  let mode: "test" | "production" | "missing" = "missing"
  if (token.startsWith("TEST-")) mode = "test"
  else if (token.startsWith("APP_USR-")) mode = "production"

  return NextResponse.json({
    mode,
    hasWebhook: !!process.env.MP_WEBHOOK_SECRET,
    hasPublicKey: !!process.env.NEXT_PUBLIC_MP_PUBLIC_KEY,
  })
}
