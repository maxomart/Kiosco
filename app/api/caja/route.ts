import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getTenantPlan } from "@/lib/plan-guard"
import { hasFeature } from "@/lib/permissions"

const openSchema = z.object({ openingBalance: z.number().min(0) })

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  try {
    const sessions = await db.cashSession.findMany({
      where: { ...(tenantId ? { tenantId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { name: true } },
        _count: { select: { sales: true } },
      },
    })
    return NextResponse.json({ sessions })
  } catch (err) {
    console.error("[GET /api/caja]", err)
    return NextResponse.json({ error: "Error al obtener cajas" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = openSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Monto inicial requerido" }, { status: 400 })

  try {
    const plan = await getTenantPlan(tenantId!)
    const multiCash = hasFeature(plan, "feature:multi_cash")

    if (!multiCash) {
      // Single-cash plans: only one OPEN session allowed at a time.
      const open = await db.cashSession.findFirst({ where: { tenantId: tenantId!, status: "OPEN" } })
      if (open) return NextResponse.json({ error: "Ya hay una caja abierta", session: open }, { status: 409 })
    } else {
      // PRO+ multi-cash: only block if THIS user already has one open
      // (a single user can't open two simultaneously, but other users can).
      const ownOpen = await db.cashSession.findFirst({
        where: { tenantId: tenantId!, status: "OPEN", userId: session.user.id! },
      })
      if (ownOpen) return NextResponse.json({ error: "Ya tenés una caja abierta", session: ownOpen }, { status: 409 })
    }

    const cashSession = await db.cashSession.create({ data: { openingBalance: parsed.data.openingBalance, tenantId: tenantId!, userId: session.user.id! } })
    return NextResponse.json({ session: cashSession }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/caja]", err)
    return NextResponse.json({ error: "Error al abrir caja" }, { status: 500 })
  }
}
