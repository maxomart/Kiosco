/**
 * WhatsApp sending via Twilio.
 *
 * Setup (Twilio Console):
 *   1. Ve a https://console.twilio.com
 *   2. Messaging → Try it out → WhatsApp
 *   3. Configura el sandbox (escanea QR o confirma número)
 *   4. Agregá en Railway:
 *      - TWILIO_ACCOUNT_SID    (Account SID from Twilio Console)
 *      - TWILIO_AUTH_TOKEN     (Auth Token from Twilio Console)
 *      - TWILIO_WHATSAPP_FROM  (ej: whatsapp:+14155238886, el número sandbox)
 *
 * Si las vars no están configuradas, sendWhatsApp() devuelve { ok: false }
 * sin tirar error — los callers degradan graciosamente.
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

/** Normaliza a formato E.164 — acepta +5491112345678 */
export function normalizePhone(phone: string): string | null {
  const trimmed = phone.replace(/[\s\-\(\)]/g, "")
  if (!trimmed.startsWith("+")) return null
  if (trimmed.length < 8) return null
  return trimmed
}

export async function sendWhatsApp(toRaw: string, body: string): Promise<SendResult> {
  if (!isWhatsAppConfigured()) {
    return { ok: false, error: "Twilio WhatsApp no está configurado en Railway" }
  }

  const to = normalizePhone(toRaw)
  if (!to) {
    return { ok: false, error: "Número inválido (debe estar en formato +5491112345678)" }
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const from = process.env.TWILIO_WHATSAPP_FROM!

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    const params = new URLSearchParams({
      From: from,
      To: `whatsapp:${to}`,
      Body: body,
    })

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      console.error("[whatsapp] Twilio error:", { status: res.status, data })
      const errorMsg = data?.message ?? `Twilio respondió ${res.status}`
      return { ok: false, error: errorMsg }
    }

    return { ok: true, sid: data?.sid }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Error de red al enviar WhatsApp" }
  }
}

/**
 * Alerta de stock bajo al número configurado del comercio.
 */
export async function sendLowStockAlert(
  toRaw: string,
  products: { name: string; stock: number; minStock: number }[],
  tenantName: string
): Promise<SendResult> {
  if (products.length === 0) return { ok: true }
  const lines = products.slice(0, 10).map(
    (p) => `• ${p.name}: ${p.stock} unidades (mín ${p.minStock})`
  )
  const more = products.length > 10 ? `\n\n…y ${products.length - 10} más` : ""
  const body = `🔔 *${tenantName}* — alerta de stock bajo:\n\n${lines.join("\n")}${more}\n\nReponé pronto para no perder ventas.`
  return sendWhatsApp(toRaw, body)
}

/**
 * Resumen diario del negocio. Invocado desde /api/cron/daily-summary.
 */
import type { BusinessContext } from "@/lib/ai-context"

export async function sendDailySummary(
  toRaw: string,
  ctx: BusinessContext
): Promise<SendResult> {
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
    }).format(n)

  const diff = ctx.today.revenue - ctx.yesterday.revenue
  const diffPct =
    ctx.yesterday.revenue > 0
      ? Math.round((diff / ctx.yesterday.revenue) * 100)
      : null
  const arrow = diff >= 0 ? "📈" : "📉"
  const diffLine =
    diffPct !== null
      ? `${arrow} ${diff >= 0 ? "+" : ""}${fmt(diff)} (${diff >= 0 ? "+" : ""}${diffPct}%) vs ayer`
      : `${arrow} ${fmt(diff)} vs ayer`

  const top = ctx.topSellers7d[0]
  const topLine = top
    ? `🏆 *Más vendido (7d):* ${top.name} — ${top.quantitySold} u.`
    : `🏆 *Más vendido:* sin datos suficientes`

  const lowStockCount =
    ctx.inventory.lowStock.length + ctx.inventory.outOfStock.length
  const stockLine =
    lowStockCount > 0
      ? `⚠️ *Stock bajo:* ${lowStockCount} producto${lowStockCount === 1 ? "" : "s"} requieren atención`
      : `✅ *Stock:* todo OK`

  const body =
    `📊 *${ctx.tenantName}* — resumen del día\n\n` +
    `💰 *Ventas hoy:* ${ctx.today.sales} · ${fmt(ctx.today.revenue)}\n` +
    `🎟️ *Ticket promedio:* ${fmt(ctx.today.avgTicket)}\n` +
    `${diffLine}\n\n` +
    `${topLine}\n` +
    `${stockLine}\n\n` +
    `¡Buen cierre! 🚀`

  return sendWhatsApp(toRaw, body)
}
