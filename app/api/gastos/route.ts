import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"

const schema = z.object({ category: z.string().min(1), amount: z.number().min(0.01), notes: z.string().optional().nullable() })

export async function GET(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from"); const to = searchParams.get("to")
  const where: any = { ...(tenantId ? { tenantId } : {}) }
  if (from || to) { where.createdAt = {}; if (from) where.createdAt.gte = new Date(from); if (to) where.createdAt.lte = new Date(to) }
  const expenses = await db.expense.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 })
  return NextResponse.json({ expenses })
}

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  const expense = await db.expense.create({ data: { ...parsed.data, tenantId: tenantId! } })
  return NextResponse.json({ expense }, { status: 201 })
}
