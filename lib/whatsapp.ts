/**
 * WhatsApp sending via UltraMsg API.
 *
 * Setup:
 *   1. Creá una cuenta en https://ultramsg.com
 *   2. Creá una instancia y escaneá el QR con tu WhatsApp Business
 *   3. Copiá el Instance ID y el Token desde el panel
 *   4. Agregá en Railway:
 *      - ULTRAMSG_INSTANCE_ID   (ej: "instance12345")
 *      - ULTRAMSG_TOKEN         (token de la instancia)
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
    process.env.ULTRAMSG_INSTANCE_ID &&
    process.env.ULTRAMSG_TOKEN
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
    return { ok: false, error: "UltraMsg no está configurado en Railway" }
  }

  const to = normalizePhone(toRaw)
  if (!to) {
    return { ok: false, error: "Número inválido (debe estar en formato +5491112345678)" }
  }

  const instanceId = process.env.ULTRAMSG_INSTANCE_ID!
  const token = process.env.ULTRAMSG_TOKEN!

  try {
    // UltraMsg requires token as a query parameter
    const url = `https://api.ultramsg.com/${instanceId}/messages/chat?token=${encodeURIComponent(token)}`
    const params = new URLSearchParams({ to, body })

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok || data?.sent === "false" || data?.error) {
      return {
        ok: false,
        error: data?.error ?? `UltraMsg respondió ${res.status}`,
      }
    }

    return { ok: true, sid: data?.id }
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
