import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { hasFeature } from "@/lib/permissions"
import type { Plan } from "@/lib/utils"

const schema = z.object({
  clientId: z.string().min(1),
  points: z.number().int(),
  description: z.string().min(1, "Descripción requerida").max(200),
})

export async function POST(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  // Plan gate: PROFESSIONAL+
  const sub = await db.subscription.findUnique({
    where: { tenantId: tenantId! },
    select: { plan: true },
  })
  const plan = (sub?.plan ?? "FREE") as Plan
  if (!hasFeature(plan, "feature:loyalty")) {
    return NextResponse.json(
      { error: "El programa de fidelidad requiere plan Professional o superior" },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { clientId, points, description } = parsed.data
  if (points === 0) {
    return NextResponse.json({ error: "El ajuste debe ser distinto de 0" }, { status: 400 })
  }

  // Validate client belongs to tenant
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { tenantId: true, loyaltyPoints: true },
  })
  if (!client || client.tenantId !== tenantId) {
    return NextResponse.json({ error: "Cliente inválido" }, { status: 404 })
  }
  // Prevent negative balance
  if (client.loyaltyPoints + points < 0) {
    return NextResponse.json(
      { error: `Puntos insuficientes. Tiene ${client.loyaltyPoints}, intentás restar ${-points}.` },
      { status: 400 }
    )
  }

  try {
    await db.$transaction([
      db.client.update({
        where: { id: clientId },
        data: { loyaltyPoints: { increment: points } },
      }),
      db.loyaltyTransaction.create({
        data: {
          clientId,
          points,
          description,
        },
      }),
    ])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[POST /api/loyalty/adjust]", err)
    return NextResponse.json({ error: "Error al ajustar puntos" }, { status: 500 })
  }
}
