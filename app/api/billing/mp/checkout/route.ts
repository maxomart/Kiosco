import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { createPreapproval } from "@/lib/mp-billing"
import { PLAN_PRICES_ARS, PLAN_LABELS_AR, type Plan } from "@/lib/utils"

export const dynamic = "force-dynamic"

const PAID_PLANS: Plan[] = ["STARTER", "PROFESSIONAL", "BUSINESS"]

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) {
    return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Only the owner can sign up the tenant for paid billing
  if (session.user.role !== "OWNER") {
    return NextResponse.json(
      { error: "Solo el dueño del comercio puede gestionar la suscripción" },
      { status: 403 }
    )
  }

  let body: { plan?: string; period?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const plan = body.plan as Plan | undefined
  if (!plan || !PAID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 })
  }

  const period: "monthly" | "annual" =
    body.period === "annual" ? "annual" : "monthly"
  const ANNUAL_DISCOUNT = 0.2

  const monthlyAmount = PLAN_PRICES_ARS[plan]
  if (!monthlyAmount || monthlyAmount <= 0) {
    return NextResponse.json({ error: "Plan sin precio configurado" }, { status: 400 })
  }

  // Anual: cobra 12 meses con 20% descuento como una sola suscripción anual.
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

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ""
  const backUrl = `${baseUrl}/configuracion/suscripcion?mp=success`

  if (!session.user.email) {
    return NextResponse.json(
      { error: "Tu cuenta no tiene email. Agregá uno antes de suscribirte." },
      { status: 400 }
    )
  }

  let preapproval
  try {
    preapproval = await createPreapproval({
      payerEmail: session.user.email,
      backUrl,
      reason: `RetailAR ${PLAN_LABELS_AR[plan]} ${period === "annual" ? "anual" : "mensual"}`,
      externalReference: tenantId!,
      amountARS: amount,
      frequencyType: period === "annual" ? "years" : "months",
    })
  } catch (err: any) {
    const rawMsg = err?.message ?? ""
    console.error("[mp/checkout] createPreapproval error:", rawMsg)
    // Surface MP's human-readable error when possible so the user knows what to do.
    let friendly = "No se pudo iniciar el pago con Mercado Pago."
    if (/MP_PLATFORM_ACCESS_TOKEN/i.test(rawMsg))
      friendly = "Mercado Pago no está configurado en el servidor. Contactá soporte."
    else if (/401|invalid.*token|unauthorized/i.test(rawMsg))
      friendly = "El token de Mercado Pago es inválido o expiró. Contactá soporte."
    else if (/payer_email/i.test(rawMsg))
      friendly = "El email no es válido para Mercado Pago. Revisá el email de tu cuenta."
    else if (/auto_recurring|transaction_amount/i.test(rawMsg))
      friendly = "El monto del plan es inválido. Contactá soporte."
    return NextResponse.json({ error: friendly, detail: rawMsg }, { status: 502 })
  }

  // Persist preliminary record so the webhook can match this preapproval.
  // Valid statuses: ACTIVE, TRIALING, PAST_DUE, PAUSED, CANCELLED. FREE is a plan, not a status.
  await db.subscription.upsert({
    where: { tenantId: tenantId! },
    create: {
      tenantId: tenantId!,
      plan: tenant.subscription?.plan ?? "FREE",
      status: tenant.subscription?.status ?? "ACTIVE",
      mpPreapprovalId: preapproval.id,
      mpStatus: "pending",
      paymentProvider: "mercadopago",
    },
    update: {
      mpPreapprovalId: preapproval.id,
      mpStatus: "pending",
      paymentProvider: "mercadopago",
    },
  })

  return NextResponse.json({
    initPoint: preapproval.init_point,
    preapprovalId: preapproval.id,
  })
}
