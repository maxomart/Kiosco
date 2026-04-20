import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can, hasFeature } from "@/lib/permissions"
import type { Plan } from "@/lib/utils"
import { z } from "zod"

const schema = z.object({ category: z.string().min(1), amount: z.number().min(0.01), notes: z.string().optional().nullable() })

async function getPlan(tenantId: string): Promise<Plan> {
  const sub = await db.subscription.findUnique({ where: { tenantId }, select: { plan: true } })
  return (sub?.plan as Plan) ?? "FREE"
}

export async function GET(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error
  if (!can(session?.user?.role, "expenses:read"))
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  if (!hasFeature(await getPlan(tenantId!), "feature:expenses"))
    return NextResponse.json({ error: "Gastos no incluido en tu plan" }, { status: 402 })
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from"); const to = searchParams.get("to")
  const where: any = { ...(tenantId ? { tenantId } : {}) }
  if (from || to) { where.createdAt = {}; if (from) where.createdAt.gte = new Date(from); if (to) where.createdAt.lte = new Date(to) }
  try {
    const expenses = await db.expense.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 })
    return NextResponse.json({ expenses })
  } catch (err) {
    console.error("[GET /api/gastos]", err)
    return NextResponse.json({ error: "Error al obtener gastos" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!can(session.user.role, "expenses:create"))
    return NextResponse.json({ error: "Sin permisos para crear gastos" }, { status: 403 })
  if (!hasFeature(await getPlan(tenantId!), "feature:expenses"))
    return NextResponse.json({ error: "Gastos no incluido en tu plan" }, { status: 402 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  try {
    const expense = await db.expense.create({ data: { ...parsed.data, tenantId: tenantId! } })
    return NextResponse.json({ expense }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/gastos]", err)
    return NextResponse.json({ error: "Error al crear gasto" }, { status: 500 })
  }
}
