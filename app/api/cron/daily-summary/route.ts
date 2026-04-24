/**
 * Daily WhatsApp summary cron.
 *
 * Wiring (Railway):
 *   Project → Cron → POST {URL}/api/cron/daily-summary every day at 22:00
 *   with header: Authorization: Bearer ${CRON_SECRET}
 *
 * Wiring (Vercel):
 *   Add to vercel.json:
 *     { "crons": [{ "path": "/api/cron/daily-summary", "schedule": "0 22 * * *" }] }
 *   Vercel automatically signs the request — but we also accept Authorization
 *   header so you can hit it from anywhere with the right secret.
 *
 * Both GET and POST are accepted so it works on either platform.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyCronSecret } from "@/lib/cron"
import { hasFeature } from "@/lib/permissions"
import { buildBusinessContext } from "@/lib/ai-context"
import { sendDailySummary, isWhatsAppConfigured } from "@/lib/whatsapp"
import type { Plan } from "@/lib/utils"

async function run(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 })
  }
  if (!isWhatsAppConfigured()) {
    return NextResponse.json({
      ok: false,
      reason: "Meta WhatsApp no está configurado",
      sent: 0, skipped: 0, errored: 0,
    }, { status: 503 })
  }

  // Find tenants with the daily-summary toggle ON, a phone, and an eligible plan.
  const ELIGIBLE: Plan[] = ["PROFESSIONAL", "BUSINESS", "ENTERPRISE"]
  const tenants = await db.tenant.findMany({
    where: {
      config: {
        whatsappDailySummary: true,
        whatsappPhone: { not: null },
      },
      subscription: {
        plan: { in: ELIGIBLE as string[] },
        status: "ACTIVE",
      },
    },
    select: {
      id: true,
      name: true,
      config: { select: { whatsappPhone: true } },
      subscription: { select: { plan: true } },
    },
  })

  let sent = 0, skipped = 0, errored = 0
  const details: { tenantId: string; ok: boolean; error?: string }[] = []

  for (const t of tenants) {
    const phone = t.config?.whatsappPhone
    if (!phone) { skipped++; continue }
    if (!hasFeature(t.subscription?.plan as Plan, "feature:whatsapp")) { skipped++; continue }

    try {
      const ctx = await buildBusinessContext(t.id, t.subscription?.plan as Plan)
      const res = await sendDailySummary(phone, ctx)
      if (res.ok) {
        sent++
        details.push({ tenantId: t.id, ok: true })
      } else {
        errored++
        details.push({ tenantId: t.id, ok: false, error: res.error })
      }
    } catch (e) {
      errored++
      const msg = e instanceof Error ? e.message : String(e)
      details.push({ tenantId: t.id, ok: false, error: msg })
      console.error("[cron/daily-summary]", t.id, msg)
    }
  }

  return NextResponse.json({
    ok: true,
    counts: { tenants: tenants.length, sent, skipped, errored },
    details,
  })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
