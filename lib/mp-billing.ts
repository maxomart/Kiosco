/**
 * MercadoPago **Suscripciones (Preapproval)** helper — used by the SaaS platform
 * to bill its tenants in ARS.
 *
 * IMPORTANT: This is the *platform-level* MP integration (RetailAR's own MP
 * account). It is intentionally separate from `lib/mercadopago.ts`, which is
 * the *per-tenant* POS integration where each merchant connects their own MP
 * account to receive customer payments.
 *
 * Docs: https://www.mercadopago.com.ar/developers/es/reference/subscriptions/_preapproval/post
 */

import crypto from "node:crypto"
import type { NextRequest } from "next/server"

const MP_API = "https://api.mercadopago.com"

function getAccessToken(): string {
  const token = process.env.MP_PLATFORM_ACCESS_TOKEN
  if (!token) {
    throw new Error(
      "MP_PLATFORM_ACCESS_TOKEN no está configurado. Agregalo en .env (token de la cuenta MP de la plataforma)."
    )
  }
  return token
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getAccessToken()}`,
    "Content-Type": "application/json",
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CreatePreapprovalInput {
  /**
   * OPTIONAL. If omitted, MP shows its own login page and the payer picks any
   * MP account. Do NOT default to the signup email — MP rejects the
   * preapproval with "Cannot operate between different countries" when the
   * email has no Argentine MP account (or belongs to a different country's MP).
   * Only pass this when the tenant *explicitly* confirms it's their ARG MP
   * account email.
   */
  payerEmail?: string
  backUrl: string
  reason: string
  externalReference: string
  amountARS: number
  /** "months" or "years" — defaults to months. */
  frequencyType?: "months" | "years"
}

export interface PreapprovalResponse {
  id: string
  init_point: string
  status: string
  payer_email?: string
  external_reference?: string
  auto_recurring?: {
    transaction_amount: number
    currency_id: string
    frequency: number
    frequency_type: string
  }
  next_payment_date?: string
}

// ─── API calls ────────────────────────────────────────────────────────────────
export async function createPreapproval(
  input: CreatePreapprovalInput
): Promise<PreapprovalResponse> {
  const body: Record<string, unknown> = {
    reason: input.reason,
    external_reference: input.externalReference,
    back_url: input.backUrl,
    auto_recurring: {
      frequency: 1,
      frequency_type: input.frequencyType ?? "months",
      transaction_amount: input.amountARS,
      currency_id: "ARS",
    },
    status: "pending", // user must authorize via init_point
  }
  // Only include payer_email when explicitly confirmed by the tenant. Sending
  // the signup email causes "Cannot operate between different countries" when
  // that email has no ARG MP account.
  if (input.payerEmail) body.payer_email = input.payerEmail

  const res = await fetch(`${MP_API}/preapproval`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MP createPreapproval failed (${res.status}): ${text}`)
  }
  return (await res.json()) as PreapprovalResponse
}

export async function getPreapproval(id: string): Promise<PreapprovalResponse> {
  const res = await fetch(`${MP_API}/preapproval/${id}`, {
    method: "GET",
    headers: authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MP getPreapproval failed (${res.status}): ${text}`)
  }
  return (await res.json()) as PreapprovalResponse
}

export async function cancelPreapproval(id: string): Promise<PreapprovalResponse> {
  const res = await fetch(`${MP_API}/preapproval/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ status: "cancelled" }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MP cancelPreapproval failed (${res.status}): ${text}`)
  }
  return (await res.json()) as PreapprovalResponse
}

export async function getPayment(paymentId: string): Promise<any> {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    method: "GET",
    headers: authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MP getPayment failed (${res.status}): ${text}`)
  }
  return res.json()
}

export async function searchPaymentsByPreapproval(preapprovalId: string): Promise<any[]> {
  // Try the dedicated preapproval payments endpoint first
  const res1 = await fetch(
    `${MP_API}/preapproval/${encodeURIComponent(preapprovalId)}/payment`,
    { method: "GET", headers: authHeaders() }
  ).catch(() => null)
  if (res1?.ok) {
    const data = await res1.json().catch(() => ({}))
    const results = data?.results ?? data?.payments ?? []
    if (results.length > 0) return results
  }

  // Fallback: payments search by preapproval_id
  const res2 = await fetch(
    `${MP_API}/v1/payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}&limit=10`,
    { method: "GET", headers: authHeaders() }
  ).catch(() => null)
  if (!res2?.ok) return []
  const data2 = await res2.json().catch(() => ({}))
  return data2?.results ?? []
}

/** Finds all preapprovals for a tenant (by external_reference = tenantId). */
export async function searchPreapprovalsByTenant(tenantId: string): Promise<PreapprovalResponse[]> {
  const res = await fetch(
    `${MP_API}/preapproval/search?external_reference=${encodeURIComponent(tenantId)}&limit=10`,
    { method: "GET", headers: authHeaders() }
  )
  if (!res.ok) return []
  const data = await res.json()
  return data?.results ?? []
}

// ─── Webhook signature verification ───────────────────────────────────────────
/**
 * Verifies the `x-signature` header from a MercadoPago webhook.
 *
 * MP sends headers like:
 *   x-signature: ts=1700000000,v1=abc123hex
 *   x-request-id: <uuid>
 *
 * The HMAC payload (per MP docs) is:
 *   id:<dataId>;request-id:<requestId>;ts:<ts>;
 *
 * We HMAC-SHA256 it with `MP_WEBHOOK_SECRET` and compare against `v1` using
 * `timingSafeEqual`.
 *
 * Returns `true` if valid, `false` otherwise. If the secret is not configured
 * we log a warning and accept (so dev environments work). Set the secret in
 * production.
 */
export function verifyWebhookSignature(
  req: NextRequest,
  dataId: string | null
): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    console.warn("[mp-billing] MP_WEBHOOK_SECRET no configurado — saltando verificación")
    return true
  }

  const sigHeader = req.headers.get("x-signature")
  const requestId = req.headers.get("x-request-id") ?? ""
  if (!sigHeader) return false

  // Parse "ts=...,v1=..."
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=").map((s) => s.trim())
      return [k, v]
    })
  ) as Record<string, string>

  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  const manifest = `id:${dataId ?? ""};request-id:${requestId};ts:${ts};`
  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex")

  try {
    const a = Buffer.from(expected, "hex")
    const b = Buffer.from(v1, "hex")
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
