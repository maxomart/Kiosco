import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"

const schema = z.object({ supplierId: z.string(), cost: z.number().min(0), amount: z.number().min(0), notes: z.string().optional().nullable() })

export async function GET(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from"); const to = searchParams.get("to")
  const where: any = { ...(tenantId ? { tenantId } : {}) }
  if (from || to) { where.createdAt = {}; if (from) where.createdAt.gte = new Date(from); if (to) where.createdAt.lte = new Date(to) }
  const recharges = await db.recharge.findMany({ where, include: { supplier: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 })
  return NextResponse.json({ recharges })
}

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  const { cost, amount, ...rest } = parsed.data
  const last = await db.recharge.findFirst({ where: { tenantId: tenantId! }, orderBy: { number: "desc" }, select: { number: true } })
  const recharge = await db.recharge.create({ data: { ...rest, cost, amount, profit: amount - cost, number: (last?.number ?? 0) + 1, tenantId: tenantId! } })
  return NextResponse.json({ recharge }, { status: 201 })
}
