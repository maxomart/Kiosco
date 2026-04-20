/**
 * WhatsApp sending via Twilio's API.
 *
 * Setup:
 *   1. Create a free Twilio account → https://www.twilio.com/try-twilio
 *   2. Activate the WhatsApp sandbox (or get production approval).
 *   3. Set these env vars in Railway:
 *      - TWILIO_ACCOUNT_SID    (starts with "AC...")
 *      - TWILIO_AUTH_TOKEN
 *      - TWILIO_WHATSAPP_FROM  (e.g. "+14155238886" — the sandbox number)
 *   4. Each tenant's owner must opt-in by sending a join message to that
 *      sandbox number from their WhatsApp before they can receive notifications.
 *      Twilio's sandbox console will tell you the exact join code.
 *
 * If the env vars are missing, sendWhatsApp() resolves with `{ ok: false }`
 * — never throws. So callers can degrade gracefully.
 */

interface SendResult {
  ok: boolean
  error?: string
  sid?: string
}

export function isWhatsAppConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM
  )
}

/** Normalize a phone number to E.164 (very basic — accepts +country prefix). */
export function normalizePhone(phone: string): string | null {
  const trimmed = phone.replace(/\s|-|\(|\)/g, "")
  if (!trimmed.startsWith("+")) return null
  if (trimmed.length < 8) return null
  return trimmed
}

export async function sendWhatsApp(toRaw: string, body: string): Promise<SendResult> {
  if (!isWhatsAppConfigured()) {
    return { ok: false, error: "Twilio no está configurado en Railway" }
  }
  const to = normalizePhone(toRaw)
  if (!to) {
    return { ok: false, error: "Número inválido (debe estar en formato +5491112345678)" }
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!
  const token = process.env.TWILIO_AUTH_TOKEN!
  const from = process.env.TWILIO_WHATSAPP_FROM!

  const fromFmt = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`
  const toFmt = `whatsapp:${to}`

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64")
    const params = new URLSearchParams({
      To: toFmt,
      From: fromFmt,
      Body: body,
    })

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return {
        ok: false,
        error: data?.message ?? `Twilio respondió ${res.status}`,
      }
    }
    return { ok: true, sid: data.sid }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Error de red al enviar WhatsApp" }
  }
}

/**
 * Builds and sends a low-stock alert to the tenant's configured WhatsApp.
 * Pass an array of products that just dropped below their minStock.
 * Caller should debounce so we don't spam (e.g. once per stock movement).
 */
export async function sendLowStockAlert(
  toRaw: string,
  products: { name: string; stock: number; minStock: number }[],
  tenantName: string
): Promise<SendResult> {
  if (products.length === 0) return { ok: true }
  const lines = products.slice(0, 10).map((p) =>
    `• ${p.name}: ${p.stock} unidades (mín ${p.minStock})`
  )
  const more = products.length > 10 ? `\n\n…y ${products.length - 10} más` : ""
  const body = `🔔 *${tenantName}* — alerta de stock bajo:\n\n${lines.join("\n")}${more}\n\nReponé pronto para no perder ventas.`
  return sendWhatsApp(toRaw, body)
}

/**
 * Sends a friendly end-of-day summary in Spanish (Argentina) using the same
 * BusinessContext the AI assistant consumes. Designed to be invoked from the
 * `/api/cron/daily-summary` job once per day (~22:00 local).
 */
import type { BusinessContext } from "@/lib/ai-context"

export async function sendDailySummary(
  toRaw: string,
  ctx: BusinessContext,
): Promise<SendResult> {
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
    }).format(n)

  const diff = ctx.today.revenue - ctx.yesterday.revenue
  const diffPct = ctx.yesterday.revenue > 0
    ? Math.round((diff / ctx.yesterday.revenue) * 100)
    : null
  const arrow = diff >= 0 ? "📈" : "📉"
  const diffLine = diffPct !== null
    ? `${arrow} ${diff >= 0 ? "+" : ""}${fmt(diff)} (${diff >= 0 ? "+" : ""}${diffPct}%) vs ayer`
    : `${arrow} ${fmt(diff)} vs ayer`

  const top = ctx.topSellers7d[0]
  const topLine = top
    ? `🏆 *Más vendido (7d):* ${top.name} — ${top.quantitySold} u.`
    : `🏆 *Más vendido:* sin datos suficientes`

  const lowStockCount = ctx.inventory.lowStock.length + ctx.inventory.outOfStock.length
  const stockLine = lowStockCount > 0
    ? `⚠️ *Stock bajo:* ${lowStockCount} producto${lowStockCount === 1 ? "" : "s"} requieren atención`
    : `✅ *Stock:* todo OK`

  const body =
`📊 *${ctx.tenantName}* — resumen del día

💰 *Ventas hoy:* ${ctx.today.sales} · ${fmt(ctx.today.revenue)}
🎟️ *Ticket promedio:* ${fmt(ctx.today.avgTicket)}
${diffLine}

${topLine}
${stockLine}

¡Buen cierre! 🚀`

  return sendWhatsApp(toRaw, body)
}
