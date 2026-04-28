import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendDigestForTenant, sendLowStockAlert, type DigestPeriod } from "@/lib/digest-generator"

export const dynamic = "force-dynamic"

/**
 * Dispara manualmente un job del cron sin esperar el horario programado.
 * Usado por la página /admin/cron para testing.
 *
 * Body: { period: "daily" | "weekly" | "monthly" | "lowstock" }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  let body: { period?: string }
  try { body = await req.json() } catch { body = {} }

  const period = body.period
  if (!period || !["daily", "weekly", "monthly", "lowstock"].includes(period)) {
    return NextResponse.json({ error: "period inválido" }, { status: 400 })
  }

  // No usamos runOnce/CronExecution para los manuales — así el user puede
  // re-ejecutar el mismo job el mismo día sin que lo bloquee la unique.
  // Pero loggeamos la run con un sufijo "-manual" para que aparezca en el log.
  const dateKey = new Date().toISOString().split("T")[0]
  const name = `${period}-manual-${Date.now()}`
  const row = await db.cronExecution.create({
    data: { name, runDate: dateKey },
  })

  try {
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

    let sent = 0
    let skipped = 0
    const details: Array<{ tenant: string; sent: boolean; reason?: string }> = []
    for (const t of tenants) {
      try {
        const r = period === "lowstock"
          ? await sendLowStockAlert(t.id)
          : await sendDigestForTenant(t.id, period as DigestPeriod)
        if (r.sent) sent++; else skipped++
        details.push({ tenant: t.name, ...r })
      } catch (e) {
        skipped++
        details.push({ tenant: t.name, sent: false, reason: String(e) })
      }
    }

    const result = { tenants: tenants.length, sent, skipped, details }
    await db.cronExecution.update({
      where: { id: row.id },
      data: { finishedAt: new Date(), result: result as any },
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    await db.cronExecution.update({
      where: { id: row.id },
      data: { finishedAt: new Date(), result: { error: String(e) } as any },
    })
    return NextResponse.json({ error: "Falló la ejecución", detail: String(e) }, { status: 500 })
  }
}
