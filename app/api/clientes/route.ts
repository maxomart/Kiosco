import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { checkQuota } from "@/lib/plan-guard"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  dni: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  creditLimit: z.number().nonnegative().optional(),
})

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  try {
    const clients = await db.client.findMany({
      where: { active: true, ...(tenantId ? { tenantId } : {}) },
      orderBy: { name: "asc" },
      include: { _count: { select: { sales: true } } },
    })

    // Aggregate totalPurchases per client (sum of sale.total)
    const ids = clients.map((c: { id: string }) => c.id)
    const sums = ids.length
      ? await db.sale.groupBy({
          by: ["clientId"],
          where: { tenantId: tenantId!, clientId: { in: ids }, status: "COMPLETED" },
          _sum: { total: true },
        })
      : []
    const sumByClient = new Map<string, number>()
    for (const s of sums) {
      if (s.clientId) sumByClient.set(s.clientId, Number(s._sum.total ?? 0))
    }

    return NextResponse.json({
      clients: clients.map((c: any) => ({
        ...c,
        creditLimit: Number(c.creditLimit ?? 0),
        currentBalance: Number(c.currentBalance ?? 0),
        totalPurchases: sumByClient.get(c.id) ?? 0,
      })),
    })
  } catch (err) {
    console.error("[GET /api/clientes]", err)
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 })
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

  // Plan hard limit (FREE = 25 clients)
  const quota = await checkQuota(tenantId!, "clients")
  if (!quota.ok) return NextResponse.json({ error: quota.message }, { status: 403 })

  try {
    const client = await db.client.create({
      data: {
        ...parsed.data,
        email: parsed.data.email || null,
        creditLimit: parsed.data.creditLimit ?? 0,
        tenantId: tenantId!,
      },
    })
    return NextResponse.json({ client }, { status: 201 })
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "DNI ya registrado" }, { status: 400 })
    return NextResponse.json({ error: "Error al crear" }, { status: 500 })
  }
}
