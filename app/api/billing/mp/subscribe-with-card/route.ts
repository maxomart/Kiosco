import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { PLAN_PRICES_ARS, PLAN_LABELS_AR, type Plan } from "@/lib/utils"
import { syncPaymentToSheet } from "@/lib/sheets-sync"

export const dynamic = "force-dynamic"

const MP_API = "https://api.mercadopago.com"
const PAID_PLANS: Plan[] = ["STARTER", "PROFESSIONAL", "BUSINESS"]
const ANNUAL_DISCOUNT = 0.2

/**
 * Suscripción "in-place": el usuario carga la tarjeta dentro de Orvex (vía
 * MP Card Brick que tokeniza en el front), y nosotros creamos el preapproval
 * directamente con `card_token_id`. MP cobra la primera cuota al toque y la
 * tarjeta queda guardada para los próximos meses — sin redirección.
 *
 * Body: { plan, period, cardTokenId, payerEmail, paymentMethodId, issuerId }
 */
export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) {
    return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  if (session.user.role !== "OWNER") {
    return NextResponse.json(
      { error: "Solo el dueño del comercio puede gestionar la suscripción" },
      { status: 403 }
    )
  }

  const accessToken = process.env.MP_PLATFORM_ACCESS_TOKEN
  if (!accessToken) {
    return NextResponse.json(
      { error: "Mercado Pago no está configurado en el servidor" },
      { status: 500 }
    )
  }

  let body: {
    plan?: string
    period?: string
    cardTokenId?: string
    payerEmail?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const plan = body.plan as Plan | undefined
  if (!plan || !PAID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 })
  }
  if (!body.cardTokenId || typeof body.cardTokenId !== "string") {
    return NextResponse.json({ error: "Falta el token de la tarjeta" }, { status: 400 })
  }
  if (!body.payerEmail || typeof body.payerEmail !== "string") {
    return NextResponse.json({ error: "Falta el email del titular" }, { status: 400 })
  }

  const period: "monthly" | "annual" = body.period === "annual" ? "annual" : "monthly"
  const monthlyAmount = PLAN_PRICES_ARS[plan]
  if (!monthlyAmount || monthlyAmount <= 0) {
    return NextResponse.json({ error: "Plan sin precio configurado" }, { status: 400 })
  }
  const amount =
    period === "annual"
      ? Math.round(monthlyAmount * 12 * (1 - ANNUAL_DISCOUNT))
      : monthlyAmount

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId! },
    include: { subscription: true },
  })
  if (!tenant) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })
  }

  const payerEmail = body.payerEmail.trim().toLowerCase()
  const planLabel = PLAN_LABELS_AR[plan]

  // ── PASO 1: COBRAR EL PRIMER PAGO (síncrono) ────────────────────────
  // /v1/payments es síncrono — MP devuelve approved/rejected en la misma
  // respuesta, no async como /preapproval. Esto evita que digamos "OK"
  // sin saber si MP cobró posta. binary_mode garantiza que NO devuelva
  // "pending" — es approved o rejected, sin grises.
  console.log(`[mp/subscribe-with-card] tenant=${tenantId} plan=${plan} amount=${amount} starting payment...`)
  let firstPayment: any
  try {
    const payRes = await fetch(`${MP_API}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        // Idempotency key — si el user reintenta, MP no cobra dos veces
        "X-Idempotency-Key": `orvex-${tenantId}-${body.cardTokenId.slice(0, 24)}`,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        token: body.cardTokenId,
        description: `Orvex ${planLabel} ${period === "annual" ? "anual" : "mensual"}`,
        payment_method_id: (body as any).paymentMethodId,
        installments: 1,
        payer: { email: payerEmail },
        external_reference: tenantId!,
        binary_mode: true,
        metadata: { plan, period, tenant_id: tenantId },
      }),
      signal: AbortSignal.timeout(25_000),
    })
    const payText = await payRes.text()
    console.log(`[mp/subscribe-with-card] payment status=${payRes.status} body=${payText.slice(0, 300)}`)
    firstPayment = JSON.parse(payText)
  } catch (err: any) {
    console.error("[mp/subscribe-with-card] payment network error:", err?.message)
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError"
    return NextResponse.json({
      error: isTimeout ? "Mercado Pago tardó demasiado en responder. Probá de nuevo." : "Error de red con Mercado Pago",
    }, { status: 502 })
  }

  if (firstPayment?.status !== "approved") {
    const detail = firstPayment?.status_detail ?? firstPayment?.message ?? firstPayment?.status ?? "unknown"
    let friendly = "La tarjeta fue rechazada por Mercado Pago."
    const lower = String(detail).toLowerCase()
    if (lower.includes("insufficient_amount")) friendly = "La tarjeta no tiene fondos suficientes."
    else if (lower.includes("call_for_authorize")) friendly = "El banco rechazó el pago. Llamalo o usá otra tarjeta."
    else if (lower.includes("high_risk")) friendly = "Mercado Pago rechazó el pago por seguridad. Probá con otra tarjeta."
    else if (lower.includes("bad_filled_security_code") || lower.includes("invalid_security_code")) friendly = "El código de seguridad (CVV) es incorrecto."
    else if (lower.includes("bad_filled_date")) friendly = "La fecha de vencimiento es incorrecta."
    else if (lower.includes("cvv")) friendly = "El código de seguridad es obligatorio. Volvé a cargar la tarjeta."
    else if (lower.includes("invalid_card") || lower.includes("invalid_token")) friendly = "La tarjeta no es válida. Volvé a cargarla."
    else if (lower.includes("rejected")) friendly = "La tarjeta fue rechazada. Probá con otra."
    console.error(`[mp/subscribe-with-card] payment NOT approved: status=${firstPayment?.status} detail=${detail}`)
    return NextResponse.json({
      error: friendly,
      detail: `${firstPayment?.status} (${detail})`,
    }, { status: 402 })
  }

  // ── PASO 2: CREAR PREAPPROVAL PARA COBROS RECURRENTES FUTUROS ──────
  // MP guardó la tarjeta del payment. El preapproval va a cobrar mes a
  // mes desde el día 30 en adelante (no cobra el día de hoy — eso ya
  // pasó en el paso 1). status:"authorized" deja la suscripción activa.
  console.log(`[mp/subscribe-with-card] payment APPROVED id=${firstPayment.id} — creating preapproval for recurring...`)
  let preapproval: any
  try {
    const startDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const preBody = {
      reason: `Orvex ${planLabel} ${period === "annual" ? "anual" : "mensual"}`,
      external_reference: tenantId!,
      payer_email: payerEmail,
      card_token_id: body.cardTokenId,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amount,
        currency_id: "ARS",
        start_date: startDate,
      },
      back_url: `${process.env.NEXTAUTH_URL ?? ""}/configuracion/suscripcion?mp=success`,
      status: "authorized",
    }
    const preRes = await fetch(`${MP_API}/preapproval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preBody),
      signal: AbortSignal.timeout(15_000),
    })
    const preText = await preRes.text()
    console.log(`[mp/subscribe-with-card] preapproval status=${preRes.status} body=${preText.slice(0, 200)}`)
    if (preRes.ok) {
      preapproval = JSON.parse(preText)
    } else {
      // El payment ya pasó OK. Si el preapproval falla, igual seguimos —
      // el user pagó el primer mes. Loggeamos para investigar y la
      // suscripción queda activa por 30 días sin recurrente automático.
      console.warn(`[mp/subscribe-with-card] preapproval failed but payment OK — continuing`)
    }
  } catch (e) {
    console.warn(`[mp/subscribe-with-card] preapproval error:`, e)
  }

  const now = new Date()
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  // Si preapproval falló, igual marcamos ACTIVE — el user ya pagó el
  // primer mes. mpPreapprovalId va vacío y la renovación automática
  // no va a pasar; el user va a tener que re-suscribirse al mes 2.
  await db.subscription.upsert({
    where: { tenantId: tenantId! },
    create: {
      tenantId: tenantId!,
      plan,
      status: "ACTIVE",
      mpPreapprovalId: preapproval?.id ?? null,
      mpStatus: preapproval ? "authorized" : "no_recurring",
      paymentProvider: "mercadopago",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      plan,
      status: "ACTIVE",
      mpPreapprovalId: preapproval?.id ?? null,
      mpStatus: preapproval ? "authorized" : "no_recurring",
      paymentProvider: "mercadopago",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelledAt: null,
    },
  })

  // Crear Invoice con el ID real del payment de MP — el webhook lo deduplica
  // por stripeInvoiceId si llega después.
  const externalId = `mp_${firstPayment.id}`
  const existing = await db.invoice.findFirst({ where: { stripeInvoiceId: externalId } })
  if (!existing) {
    try {
      const sub = await db.subscription.findUnique({ where: { tenantId: tenantId! } })
      if (sub) {
        const inv = await db.invoice.create({
          data: {
            subscriptionId: sub.id,
            number: `MP-${firstPayment.id}`,
            stripeInvoiceId: externalId,
            amount: Number(firstPayment.transaction_amount ?? amount),
            currency: (firstPayment.currency_id ?? "ARS").toUpperCase(),
            status: "PAID",
            paidAt: firstPayment.date_approved ? new Date(firstPayment.date_approved) : now,
          },
        })
        syncPaymentToSheet(inv.id)
      }
    } catch (e) {
      console.error("[mp/subscribe-with-card] invoice insert failed:", e)
    }
  }

  return NextResponse.json({
    ok: true,
    plan,
    preapprovalId: preapproval?.id ?? null,
    paymentId: firstPayment.id,
  })
}
