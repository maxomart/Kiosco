import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { buildResumenDia } from "@/lib/ai-resumen"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const requestedTenantId = searchParams.get("tenantId")
  if (!requestedTenantId) {
    return NextResponse.json({ resumen: null }, { status: 200 })
  }

  const session = await auth()
  if (!session) return NextResponse.json({ resumen: null }, { status: 401 })
  const role = (session.user as any)?.role
  const sessionTenantId = (session.user as any)?.tenantId
  if (role !== "SUPER_ADMIN" && sessionTenantId !== requestedTenantId) {
    return NextResponse.json({ resumen: null }, { status: 403 })
  }

  const resumen = await buildResumenDia(requestedTenantId)
  return NextResponse.json({ resumen })
}
