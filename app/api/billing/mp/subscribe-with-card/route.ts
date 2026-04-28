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

  // Crear preapproval autorizado de una con card_token_id. MP cobra la
  // primera cuota inmediatamente y guarda la tarjeta para las siguientes.
  const mpBody = {
    reason: `Orvex ${PLAN_LABELS_AR[plan]} ${period === "annual" ? "anual" : "mensual"}`,
    external_reference: tenantId!,
    payer_email: body.payerEmail.trim().toLowerCase(),
    card_token_id: body.cardTokenId,
    auto_recurring: {
      frequency: 1,
      frequency_type: period === "annual" ? "months" : "months", // MP no soporta "years" → 12 meses si anual
      transaction_amount: amount,
      currency_id: "ARS",
    },
    back_url: `${process.env.NEXTAUTH_URL ?? ""}/configuracion/suscripcion?mp=success`,
    status: "authorized",
  }

  let preapproval: any
  console.log(`[mp/subscribe-with-card] tenant=${tenantId} plan=${plan} amount=${amount} starting MP request...`)
  try {
    const res = await fetch(`${MP_API}/preapproval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mpBody),
      signal: AbortSignal.timeout(20_000),
    })
    const text = await res.text()
    console.log(`[mp/subscribe-with-card] MP responded status=${res.status} body=${text}`)
    if (!res.ok) {
      console.error("[mp/subscribe-with-card] MP error:", res.status, text)
      console.error("[mp/subscribe-with-card] MP request body was:", JSON.stringify(mpBody))
      let friendly = "No se pudo procesar el pago. Probá con otra tarjeta."
      const lower = text.toLowerCase()
      if (lower.includes("cc_rejected_insufficient_amount")) friendly = "Fondos insuficientes en la tarjeta."
      else if (lower.includes("cc_rejected_bad_filled_security_code")) friendly = "El código de seguridad es incorrecto."
      else if (lower.includes("cc_rejected_bad_filled_date")) friendly = "La fecha de vencimiento es incorrecta."
      else if (lower.includes("cc_rejected_high_risk")) friendly = "El pago fue rechazado por riesgo. Probá con otra tarjeta."
      else if (lower.includes("cc_rejected_call_for_authorize")) friendly = "Tenés que autorizar el pago con tu banco."
      else if (lower.includes("cc_rejected_other_reason")) friendly = "La tarjeta rechazó el pago. Probá con otra."
      else if (lower.includes("invalid_card")) friendly = "La tarjeta no es válida."
      return NextResponse.json({ error: friendly, detail: text }, { status: 502 })
    }
    preapproval = JSON.parse(text)
    console.log(`[mp/subscribe-with-card] preapproval created id=${preapproval?.id} status=${preapproval?.status}`)
  } catch (err: any) {
    console.error("[mp/subscribe-with-card] network error:", err?.message, err?.name)
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError"
    return NextResponse.json({
      error: isTimeout
        ? "Mercado Pago tardó demasiado en responder. Probá de nuevo."
        : "Error de red con Mercado Pago",
    }, { status: 502 })
  }

  // ── VERIFICAR EL PRIMER COBRO REAL ──────────────────────────────────
  // Crear el preapproval NO significa que MP haya cobrado — sólo que la
  // tarjeta es válida y MP la guardó. El primer pago se procesa async.
  // Polleamos el endpoint de payments hasta confirmar que el primer
  // payment está "approved", o reportamos error al user.
  console.log(`[mp/subscribe-with-card] polling payments for preapproval ${preapproval.id}...`)
  let firstPayment: any = null
  const maxAttempts = 8 // hasta ~16s
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    try {
      const payRes = await fetch(
        `${MP_API}/preapproval/${encodeURIComponent(preapproval.id)}/payment`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8_000) }
      )
      if (payRes.ok) {
        const payData = await payRes.json()
        const results = payData?.results ?? payData?.payments ?? []
        if (results.length > 0) {
          firstPayment = results[0]
          console.log(`[mp/subscribe-with-card] payment found attempt=${i + 1} status=${firstPayment.status}`)
          if (firstPayment.status === "approved" || firstPayment.status === "rejected") break
        } else {
          console.log(`[mp/subscribe-with-card] no payments yet attempt=${i + 1}`)
        }
      }
    } catch (e) {
      console.warn(`[mp/subscribe-with-card] payment poll attempt=${i + 1} failed`, e)
    }
  }

  if (!firstPayment) {
    // MP nunca generó un payment — la suscripción quedó pending. Mejor
    // cancelar el preapproval y avisar al user.
    console.error(`[mp/subscribe-with-card] no payment after ${maxAttempts * 2}s`)
    return NextResponse.json({
      error: "Mercado Pago no procesó el cobro. Probá de nuevo o usá otra tarjeta.",
    }, { status: 502 })
  }

  if (firstPayment.status !== "approved") {
    // El cobro fue rechazado (insufficient funds, banco rechazó, etc).
    const detail = firstPayment.status_detail ?? firstPayment.status
    let friendly = "La tarjeta fue rechazada por Mercado Pago."
    const lower = String(detail).toLowerCase()
    if (lower.includes("insufficient_amount")) friendly = "La tarjeta no tiene fondos suficientes."
    else if (lower.includes("call_for_authorize")) friendly = "El banco rechazó el pago. Llamalo o usá otra tarjeta."
    else if (lower.includes("high_risk")) friendly = "Mercado Pago rechazó el pago por seguridad. Probá con otra tarjeta."
    else if (lower.includes("bad_filled")) friendly = "Hay un dato incorrecto en la tarjeta (CVV o vencimiento)."
    else if (lower.includes("rejected")) friendly = "La tarjeta fue rechazada. Probá con otra."
    console.error(`[mp/subscribe-with-card] payment rejected status=${firstPayment.status} detail=${detail}`)
    return NextResponse.json({
      error: friendly,
      detail: `MP payment status: ${firstPayment.status} (${detail})`,
    }, { status: 402 })
  }

  // ── COBRO CONFIRMADO ────────────────────────────────────────────────
  // Recién acá marcamos la suscripción como ACTIVE y creamos el invoice.
  console.log(`[mp/subscribe-with-card] payment APPROVED id=${firstPayment.id} amount=${firstPayment.transaction_amount}`)
  const now = new Date()
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  await db.subscription.upsert({
    where: { tenantId: tenantId! },
    create: {
      tenantId: tenantId!,
      plan,
      status: "ACTIVE",
      mpPreapprovalId: preapproval.id,
      mpStatus: "authorized",
      paymentProvider: "mercadopago",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      plan,
      status: "ACTIVE",
      mpPreapprovalId: preapproval.id,
      mpStatus: "authorized",
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
    preapprovalId: preapproval.id,
  })
}
