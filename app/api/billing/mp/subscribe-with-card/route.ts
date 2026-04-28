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
  try {
    const res = await fetch(`${MP_API}/preapproval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mpBody),
    })
    const text = await res.text()
    if (!res.ok) {
      console.error("[mp/subscribe-with-card] MP error:", res.status, text)
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
  } catch (err: any) {
    console.error("[mp/subscribe-with-card] network error:", err?.message)
    return NextResponse.json({ error: "Error de red con Mercado Pago" }, { status: 502 })
  }

  // Persist subscription as ACTIVE + provider=mercadopago + plan upgraded.
  // El webhook va a recibir el `payment` event después y crear el Invoice
  // (con dedupe por stripeInvoiceId), pero podemos crear uno preliminar
  // acá para no esperar al webhook. El dedupe lo cubre.
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

  // Crear Invoice preliminar — el webhook lo deduplica por stripeInvoiceId si llega después.
  const externalId = `mp_initial_${preapproval.id}`
  const existing = await db.invoice.findFirst({ where: { stripeInvoiceId: externalId } })
  if (!existing) {
    try {
      const sub = await db.subscription.findUnique({ where: { tenantId: tenantId! } })
      if (sub) {
        const inv = await db.invoice.create({
          data: {
            subscriptionId: sub.id,
            number: `MP-${preapproval.id.slice(0, 10).toUpperCase()}`,
            stripeInvoiceId: externalId,
            amount,
            currency: "ARS",
            status: "PAID",
            paidAt: now,
          },
        })
        syncPaymentToSheet(inv.id)
      }
    } catch (e) {
      console.error("[mp/subscribe-with-card] preliminary invoice failed:", e)
    }
  }

  return NextResponse.json({
    ok: true,
    plan,
    preapprovalId: preapproval.id,
  })
}
