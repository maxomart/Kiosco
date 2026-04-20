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
  try {
    const recharges = await db.recharge.findMany({ where, include: { supplier: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 })
    return NextResponse.json({ recharges })
  } catch (err) {
    console.error("[GET /api/cargas]", err)
    return NextResponse.json({ error: "Error al obtener cargas" }, { status: 500 })
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
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  try {
    const { cost, amount, supplierId, ...rest } = parsed.data
    // Verify supplier belongs to tenant
    const supplier = await db.supplier.findUnique({ where: { id: supplierId }, select: { tenantId: true } })
    if (!supplier || supplier.tenantId !== tenantId) {
      return NextResponse.json({ error: "Proveedor inválido" }, { status: 400 })
    }
    const last = await db.recharge.findFirst({ where: { tenantId: tenantId! }, orderBy: { number: "desc" }, select: { number: true } })
    const recharge = await db.recharge.create({ data: { ...rest, supplierId, cost, amount, profit: amount - cost, number: (last?.number ?? 0) + 1, tenantId: tenantId! } })
    return NextResponse.json({ recharge }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/cargas]", err)
    return NextResponse.json({ error: "Error al crear carga" }, { status: 500 })
  }
}
