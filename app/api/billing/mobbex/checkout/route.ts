import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { createMobbexCheckout, isMobbexConfigured } from "@/lib/mobbex-billing"
import { PLAN_PRICES_ARS, PLAN_LABELS_AR, type Plan } from "@/lib/utils"

export const dynamic = "force-dynamic"

const PAID_PLANS: Plan[] = ["STARTER", "PROFESSIONAL", "BUSINESS"]
const ANNUAL_DISCOUNT = 0.2

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER")
    return NextResponse.json({ error: "Solo el dueño puede gestionar la suscripción" }, { status: 403 })
  if (!isMobbexConfigured())
    return NextResponse.json({ error: "Mobbex no está configurado en el servidor" }, { status: 503 })

  let body: { plan?: string; period?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const plan = body.plan as Plan | undefined
  if (!plan || !PAID_PLANS.includes(plan))
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 })

  const period: "monthly" | "annual" = body.period === "annual" ? "annual" : "monthly"
  const monthlyAmount = PLAN_PRICES_ARS[plan]
  if (!monthlyAmount) return NextResponse.json({ error: "Plan sin precio" }, { status: 400 })

  const amount = period === "annual"
    ? Math.round(monthlyAmount * 12 * (1 - ANNUAL_DISCOUNT))
    : monthlyAmount

  const tenant = await db.tenant.findUnique({ where: { id: tenantId! } })
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })

  const baseUrl = process.env.NEXTAUTH_URL ?? ""
  const returnUrl = `${baseUrl}/configuracion/suscripcion?mobbex=success`

  let result
  try {
    result = await createMobbexCheckout(
      {
        name: `RetailAR ${PLAN_LABELS_AR[plan]}`,
        description: `RetailAR ${PLAN_LABELS_AR[plan]} ${period === "annual" ? "anual" : "mensual"}`,
        amountARS: amount,
        interval: period === "annual" ? "1y" : "1m",
        returnUrl,
      },
      {
        name: session.user.name ?? tenant.name,
        email: session.user.email!,
        externalReference: tenantId!,
      }
    )
  } catch (err: any) {
    console.error("[mobbex/checkout] error:", err?.message)
    return NextResponse.json({ error: "No se pudo iniciar el pago con Mobbex", detail: err?.message }, { status: 502 })
  }

  // Store composite ID "subscriptionUid:subscriberUid" in mpPreapprovalId
  const compositeId = `mobbex:${result.subscriptionUid}:${result.subscriberUid}`

  await db.subscription.upsert({
    where: { tenantId: tenantId! },
    create: {
      tenantId: tenantId!,
      plan: "STARTER",
      status: "STARTER",
      mpPreapprovalId: compositeId,
      mpStatus: "pending",
      paymentProvider: "mobbex",
    },
    update: {
      mpPreapprovalId: compositeId,
      mpStatus: "pending",
      paymentProvider: "mobbex",
    },
  })

  return NextResponse.json({ checkoutUrl: result.checkoutUrl })
}
