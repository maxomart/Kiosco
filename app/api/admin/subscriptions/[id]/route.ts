import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { PLAN_PRICES_USD, type Plan } from "@/lib/utils"

const patchSchema = z.object({
  plan: z.enum(["FREE", "STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"]).optional(),
  status: z.enum(["ACTIVE", "TRIALING", "CANCELLED", "PAST_DUE", "PAUSED"]).optional(),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await ctx.params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const sub = await db.subscription.findUnique({ where: { id } })
  if (!sub) return NextResponse.json({ error: "Suscripción no encontrada" }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (parsed.data.plan) {
    data.plan = parsed.data.plan
    data.priceUSD = PLAN_PRICES_USD[parsed.data.plan as Plan] ?? 0
  }
  if (parsed.data.status) {
    data.status = parsed.data.status
    if (parsed.data.status === "CANCELLED") data.cancelledAt = new Date()
  }
  if (parsed.data.billingCycle) data.billingCycle = parsed.data.billingCycle

  await db.subscription.update({ where: { id }, data })
  return NextResponse.json({ ok: true })
}
