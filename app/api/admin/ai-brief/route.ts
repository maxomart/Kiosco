import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getOpenAI, isOpenAIConfigured, DEFAULT_MODEL } from "@/lib/openai"

/**
 * GET /api/admin/ai-brief
 *
 * Builds a quick "what happened in the SaaS today" summary for the
 * super-admin dashboard. Pulls real numbers from the DB (signups, churn,
 * MRR delta, top sellers across tenants), feeds them to gpt-4o-mini,
 * returns a 2-3 sentence Spanish brief written like a colleague.
 *
 * Falls back to a deterministic template if OPENAI_API_KEY isn't set,
 * so the dashboard never has an empty IA box.
 */

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  // ── Gather facts ────────────────────────────────────────────────
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const weekAgo = new Date(todayStart); weekAgo.setDate(weekAgo.getDate() - 7)

  const [
    signupsToday,
    signupsYesterday,
    cancelsLast7,
    activeSubs,
    salesToday,
    salesYesterday,
    topProducts,
    failedInvoices,
  ] = await Promise.all([
    db.tenant.count({ where: { createdAt: { gte: todayStart } } }),
    db.tenant.count({
      where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
    }),
    db.subscription.count({
      where: { status: "CANCELLED", updatedAt: { gte: weekAgo } },
    }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.sale.count({ where: { createdAt: { gte: todayStart }, status: "COMPLETED" } }),
    db.sale.count({
      where: {
        createdAt: { gte: yesterdayStart, lt: todayStart },
        status: "COMPLETED",
      },
    }),
    db.saleItem
      .groupBy({
        by: ["productName"],
        where: { sale: { createdAt: { gte: weekAgo }, status: "COMPLETED" } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 3,
      })
      .catch(() => [] as any[]),
    db.invoice.count({ where: { status: "FAILED", createdAt: { gte: weekAgo } } }),
  ])

  const facts = {
    signupsToday,
    signupsYesterday,
    cancelsLast7,
    activeSubs,
    salesToday,
    salesYesterday,
    topProducts: topProducts.map((p: any) => ({
      name: p.productName,
      qty: Number(p._sum?.quantity ?? 0),
    })),
    failedInvoices,
  }

  if (!isOpenAIConfigured()) {
    return NextResponse.json({
      summary: deterministicBrief(facts),
      model: "fallback",
      facts,
    })
  }

  // ── Ask the model ───────────────────────────────────────────────
  const prompt = `Sos asistente del dueño de un SaaS argentino para kioscos llamado Orvex.
Hoy es ${now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}.
Hechos del día (no inventes números):
${JSON.stringify(facts, null, 2)}

Escribí 2-3 oraciones, en castellano rioplatense, tono de colega tranquilo (no consultor). Mencioná solo lo más relevante.
Si no pasó nada importante, decilo sin disimular ("día tranquilo, sin sorpresas").
Sin emojis. Sin saludos. Sin viñetas.`

  try {
    const client = getOpenAI()
    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 220,
      temperature: 0.5,
    })
    const summary =
      completion.choices[0]?.message?.content?.trim() ?? deterministicBrief(facts)
    return NextResponse.json({ summary, model: DEFAULT_MODEL, facts })
  } catch (e: any) {
    console.error("[admin/ai-brief] OpenAI failed:", e?.message ?? e)
    return NextResponse.json({
      summary: deterministicBrief(facts),
      model: "fallback",
      facts,
      error: "openai-unavailable",
    })
  }
}

function deterministicBrief(f: {
  signupsToday: number
  signupsYesterday: number
  cancelsLast7: number
  activeSubs: number
  salesToday: number
  salesYesterday: number
  failedInvoices: number
}): string {
  const parts: string[] = []
  if (f.signupsToday > 0) {
    parts.push(`Hoy entraron ${f.signupsToday} signup${f.signupsToday !== 1 ? "s" : ""}.`)
  } else {
    parts.push("Hoy no entró ningún signup.")
  }
  parts.push(`Hay ${f.activeSubs} suscripciones activas.`)
  if (f.cancelsLast7 > 0) {
    parts.push(`En los últimos 7 días cancelaron ${f.cancelsLast7}.`)
  }
  if (f.failedInvoices > 0) {
    parts.push(`Atención: ${f.failedInvoices} factura${f.failedInvoices !== 1 ? "s" : ""} fallida${f.failedInvoices !== 1 ? "s" : ""} esta semana — revisá pagos.`)
  }
  return parts.join(" ")
}
