import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyCronSecret } from "@/lib/cron"
import { sendDigestForTenant, sendLowStockAlert, type DigestPeriod } from "@/lib/digest-generator"

/**
 * Email digest cron.
 *
 * Cron schedule (Railway):
 *   Daily at 22:00:    /api/cron/email-digest?period=daily
 *   Weekly on Sun 22:00: /api/cron/email-digest?period=weekly
 *   Monthly on day 1 22:00: /api/cron/email-digest?period=monthly
 *   Daily at 09:00:    /api/cron/email-digest?period=lowstock (warns about reorders)
 *
 * Authorization: Bearer ${CRON_SECRET}
 *
 * Iterates all active tenants whose `emailXxxSummary` flag matches the period.
 */
async function run(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const period = searchParams.get("period") as DigestPeriod | "lowstock" | null
  if (!period || !["daily", "weekly", "monthly", "lowstock"].includes(period)) {
    return NextResponse.json({ error: "?period= daily|weekly|monthly|lowstock" }, { status: 400 })
  }

  // Pre-filter tenants by which flag is on (so we don't iterate ALL tenants every run)
  const filterField =
    period === "daily" ? "emailDailySummary" :
    period === "weekly" ? "emailWeeklySummary" :
    period === "monthly" ? "emailMonthlySummary" :
    "emailLowStockAlerts"

  const tenants = await db.tenant.findMany({
    where: {
      active: true,
      config: { [filterField]: true } as any,
    },
    select: { id: true, name: true },
  })

  const results: Array<{ tenantId: string; name: string; sent: boolean; reason?: string }> = []

  // Run sequentially to avoid hitting rate limits on Resend / OpenAI
  for (const t of tenants) {
    try {
      const result = period === "lowstock"
        ? await sendLowStockAlert(t.id)
        : await sendDigestForTenant(t.id, period as DigestPeriod)
      results.push({ tenantId: t.id, name: t.name, ...result })
    } catch (err) {
      console.error(`[cron email-digest] tenant ${t.id} failed:`, err)
      results.push({ tenantId: t.id, name: t.name, sent: false, reason: "exception" })
    }
  }

  const sent = results.filter((r) => r.sent).length
  const skipped = results.length - sent

  return NextResponse.json({
    ok: true,
    period,
    totalTenants: tenants.length,
    sent,
    skipped,
    results: results.slice(0, 50), // truncate for response size
  })
}

export async function POST(req: NextRequest) { return run(req) }
export async function GET(req: NextRequest) { return run(req) }
