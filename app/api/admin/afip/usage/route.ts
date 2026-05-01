import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getGlobalInvoiceUsage } from "@/lib/afip-quota"

export const dynamic = "force-dynamic"

/** Stats globales del SaaS para monitorear uso del cupo de AfipSDK. */
export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const usage = await getGlobalInvoiceUsage()
  return NextResponse.json(usage)
}
