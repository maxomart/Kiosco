import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { runBotIfConfigured } from "@/lib/bot-simulator"

export const dynamic = "force-dynamic"

/** Dispara el bot simulator on-demand. Solo SUPER_ADMIN. */
export async function POST() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const res = await runBotIfConfigured()
    if (!res.ok) {
      return NextResponse.json({ error: res.reason ?? "Falló" }, { status: 400 })
    }
    return NextResponse.json(res)
  } catch (e: any) {
    console.error("[admin/bot/run]", e)
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 })
  }
}
