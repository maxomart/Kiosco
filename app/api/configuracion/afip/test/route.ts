import { NextResponse } from "next/server"
import { getSessionTenant } from "@/lib/tenant"
import { testAfipConnection } from "@/lib/afip-sdk"

export const dynamic = "force-dynamic"

/** POST: dispara un test contra ARCA con las credenciales del tenant. */
export async function POST() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Solo el dueño puede testear AFIP" }, { status: 403 })
  }

  const result = await testAfipConnection(tenantId!)
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
