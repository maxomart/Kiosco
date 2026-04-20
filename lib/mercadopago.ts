/**
 * MercadoPago integration via raw REST API (no SDK to keep deps small).
 *
 * SETUP (cliente final):
 *   1. Ir a https://www.mercadopago.com.ar/developers
 *   2. Crear una aplicación (tipo "Pagos online")
 *   3. Copiar el ACCESS_TOKEN de Producción
 *   4. Pegarlo en /configuracion/mercadopago dentro de RetailAR
 *
 * Usamos la API de "Preferences" (Checkout Pro):
 *   POST https://api.mercadopago.com/checkout/preferences
 *   - Devuelve un init_point (URL) que el cliente abre.
 *   - El init_point se renderiza como QR para que el cliente lo escanee
 *     con la app de Mercado Pago.
 *   - Para confirmar el pago, polleamos el endpoint de búsqueda de pagos
 *     filtrando por external_reference.
 *
 * Más adelante, para terminales QR Pro físicas, se puede migrar a:
 *   POST /instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs
 */

const MP_BASE = "https://api.mercadopago.com"

export interface MPItem {
  id?: string
  title: string
  quantity: number
  unit_price: number
  currency_id?: string
}

export interface MPPreferenceResult {
  id: string
  init_point: string
  sandbox_init_point?: string
}

export interface MPPaymentStatus {
  status: "pending" | "approved" | "rejected" | "in_process" | "cancelled" | "refunded" | "unknown"
  paymentId?: string | number
  raw?: any
}

/**
 * Crea una preferencia de pago. Devuelve el id y el init_point (URL para QR).
 */
export async function createPreference(
  accessToken: string,
  items: MPItem[],
  externalReference: string,
  notificationUrl?: string,
): Promise<MPPreferenceResult> {
  const body: any = {
    items: items.map((i) => ({
      id: i.id ?? "item",
      title: i.title,
      quantity: Math.max(1, Math.floor(i.quantity)),
      unit_price: Number(i.unit_price.toFixed(2)),
      currency_id: i.currency_id ?? "ARS",
    })),
    external_reference: externalReference,
  }
  if (notificationUrl) body.notification_url = notificationUrl

  const res = await fetch(`${MP_BASE}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.message || data?.error || `MP error ${res.status}`
    throw new Error(msg)
  }
  return {
    id: data.id,
    init_point: data.init_point,
    sandbox_init_point: data.sandbox_init_point,
  }
}

/**
 * Busca pagos asociados a un external_reference y devuelve el último status.
 * Devuelve "pending" si todavía no hay pagos registrados.
 */
export async function getPaymentStatusByReference(
  accessToken: string,
  externalReference: string,
): Promise<MPPaymentStatus> {
  const url = `${MP_BASE}/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc&limit=10`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.message || `MP error ${res.status}`)
  }
  const results: any[] = data?.results ?? []
  if (results.length === 0) {
    return { status: "pending" }
  }
  // Cualquier "approved" lo damos por bueno
  const approved = results.find((r) => r.status === "approved")
  if (approved) return { status: "approved", paymentId: approved.id, raw: approved }
  const last = results[0]
  return { status: (last?.status ?? "unknown") as any, paymentId: last?.id, raw: last }
}

/**
 * Obtiene info básica de una preferencia (no de su pago).
 */
export async function getPreference(accessToken: string, preferenceId: string) {
  const res = await fetch(`${MP_BASE}/checkout/preferences/${preferenceId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`MP error ${res.status}`)
  return res.json()
}

/**
 * Helper para generar URL de QR a partir de un init_point usando la API
 * pública de Google Charts (no requiere instalar dependencias).
 *
 * Nota: Google Charts QR está marcado como "deprecated" pero sigue
 * funcionando. Para producción a largo plazo, migrar a la lib `qrcode`.
 */
export function qrImageUrl(data: string, size = 320): string {
  const encoded = encodeURIComponent(data)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`
}
