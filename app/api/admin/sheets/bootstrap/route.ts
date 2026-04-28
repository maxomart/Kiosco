import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { bootstrapSheet, isConfigured } from "@/lib/sheets-sync"

export const dynamic = "force-dynamic"

/**
 * POST { target: "users" | "payments" | "both" }
 * Limpia el sheet y reescribe todo lo histórico desde la DB.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  let body: { target?: "users" | "payments" | "both" } = {}
  try {
    body = await req.json()
  } catch { /* ok, default */ }

  const target = body.target ?? "both"

  if (target !== "both" && target !== "users" && target !== "payments") {
    return NextResponse.json({ error: "target inválido" }, { status: 400 })
  }

  const results: Record<string, { ok: boolean; count?: number; error?: string }> = {}

  if (target === "users" || target === "both") {
    if (!isConfigured("users")) {
      results.users = { ok: false, error: "SHEETS_WEBHOOK_USERS_URL no configurado" }
    } else {
      results.users = await bootstrapSheet("users")
    }
  }

  if (target === "payments" || target === "both") {
    if (!isConfigured("payments")) {
      results.payments = { ok: false, error: "SHEETS_WEBHOOK_PAYMENTS_URL no configurado" }
    } else {
      results.payments = await bootstrapSheet("payments")
    }
  }

  return NextResponse.json({ results })
}
