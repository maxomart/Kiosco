import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isConfigured } from "@/lib/sheets-sync"

export const dynamic = "force-dynamic"

/** Devuelve si los 2 webhooks de Sheets están configurados. */
export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  return NextResponse.json({
    users: isConfigured("users"),
    payments: isConfigured("payments"),
    secret: !!process.env.SHEETS_WEBHOOK_SECRET,
  })
}
