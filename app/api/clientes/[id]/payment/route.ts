import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getTenantPlan } from "@/lib/plan-guard"
import { hasFeature } from "@/lib/permissions"

// Cuenta corriente: register a payment received from a client (reduces their balance).
// Plan-gated: STARTER+ (proxied via feature:custom_logo until a dedicated feature key exists).
// Role-gated: ADMIN / OWNER / SUPER_ADMIN only.

const paymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.string().min(1).default("CASH"),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

async function checkOwnership(id: string, tenantId: string | null, sup: boolean) {
  const c = await db.client.findUnique({ where: { id }, select: { tenantId: true } })
  if (!c) return "not_found"
  if (!sup && c.tenantId !== tenantId) return "forbidden"
  return "ok"
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session, isSuperAdmin } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const role = session.user.role
  if (!["SUPER_ADMIN", "OWNER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Permiso insuficiente" }, { status: 403 })
  }

  if (!isSuperAdmin) {
    const plan = await getTenantPlan(tenantId!)
    // TODO: replace feature:custom_logo proxy with a dedicated feature:cuenta_corriente
    if (!hasFeature(plan, "feature:custom_logo")) {
      return NextResponse.json({ error: "Cuenta corriente disponible en plan Starter o superior" }, { status: 403 })
    }
  }

  const { id } = await params
  const own = await checkOwnership(id, tenantId, isSuperAdmin)
  if (own !== "ok") return NextResponse.json({ error: own === "not_found" ? "Cliente no encontrado" : "No autorizado" }, { status: own === "not_found" ? 404 : 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  try {
    const { client, payment } = await db.$transaction(async (tx) => {
      const c = await tx.client.findUnique({ where: { id }, select: { tenantId: true, currentBalance: true } })
      if (!c) throw new Error("Cliente no encontrado")
      const payment = await tx.clientPayment.create({
        data: {
          amount: parsed.data.amount,
          paymentMethod: parsed.data.paymentMethod,
          reference: parsed.data.reference || null,
          notes: parsed.data.notes || null,
          clientId: id,
          tenantId: c.tenantId,
          userId: session.user.id,
        },
      })
      const updated = await tx.client.update({
        where: { id },
        data: { currentBalance: { decrement: parsed.data.amount } },
      })
      return { client: updated, payment }
    })

    return NextResponse.json({
      payment,
      client: {
        ...client,
        creditLimit: Number(client.creditLimit),
        currentBalance: Number(client.currentBalance),
      },
    }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/clientes/[id]/payment]", err)
    return NextResponse.json({ error: "Error al registrar pago" }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const { id } = await params
  const own = await checkOwnership(id, tenantId, isSuperAdmin)
  if (own !== "ok") return NextResponse.json({ error: own === "not_found" ? "Cliente no encontrado" : "No autorizado" }, { status: own === "not_found" ? 404 : 403 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100)
  const skip = (page - 1) * limit

  const [payments, total] = await Promise.all([
    db.clientPayment.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { user: { select: { name: true } } },
    }),
    db.clientPayment.count({ where: { clientId: id } }),
  ])

  return NextResponse.json({
    payments: payments.map((p: any) => ({ ...p, amount: Number(p.amount) })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}
