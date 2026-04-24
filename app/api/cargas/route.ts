import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can, hasFeature } from "@/lib/permissions"
import type { Plan } from "@/lib/utils"
import { z } from "zod"

const itemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1),
  unitCost: z.number().min(0),
})

const schema = z.object({
  supplierId: z.string(),
  items: z.array(itemSchema).min(1, "Agregá al menos un producto"),
  discount: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  updateCostPrice: z.boolean().optional().default(false),
})

async function getPlan(tenantId: string): Promise<Plan> {
  const sub = await db.subscription.findUnique({ where: { tenantId }, select: { plan: true } })
  return (sub?.plan as Plan) ?? "FREE"
}

export async function GET(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error
  if (!can(session?.user?.role, "recharges:read"))
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  if (!hasFeature(await getPlan(tenantId!), "feature:recharges"))
    return NextResponse.json({ error: "Cargas no incluido en tu plan" }, { status: 402 })
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const where: any = { ...(tenantId ? { tenantId } : {}) }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) where.createdAt.lte = new Date(to)
  }
  try {
    const recharges = await db.recharge.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            unitCost: true,
            totalCost: true,
            productId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    return NextResponse.json({ recharges })
  } catch (err) {
    console.error("[GET /api/cargas]", err)
    return NextResponse.json({ error: "Error al obtener cargas" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!can(session.user.role, "recharges:create"))
    return NextResponse.json({ error: "Sin permisos para crear cargas" }, { status: 403 })
  if (!hasFeature(await getPlan(tenantId!), "feature:recharges"))
    return NextResponse.json({ error: "Cargas no incluido en tu plan" }, { status: 402 })

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

  try {
    const { supplierId, items, discount, notes, updateCostPrice } = parsed.data

    // Verify supplier belongs to tenant
    const supplier = await db.supplier.findUnique({
      where: { id: supplierId },
      select: { tenantId: true },
    })
    if (!supplier || supplier.tenantId !== tenantId) {
      return NextResponse.json({ error: "Proveedor inválido" }, { status: 400 })
    }

    // Verify all products belong to tenant
    const productIds = items.map((i) => i.productId)
    const products = await db.product.findMany({
      where: { id: { in: productIds }, tenantId: tenantId! },
      select: { id: true, name: true, stock: true },
    })
    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: "Algunos productos no existen o no pertenecen a tu cuenta" },
        { status: 400 }
      )
    }

    const productMap = new Map(products.map((p) => [p.id, p]))

    // Totals
    const subtotal = items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0)
    const total = Math.max(0, subtotal - discount)

    const lastNumber = await db.recharge.findFirst({
      where: { tenantId: tenantId! },
      orderBy: { number: "desc" },
      select: { number: true },
    })
    const nextNumber = (lastNumber?.number ?? 0) + 1

    // Transaction: create recharge + items + update stock + movements
    const recharge = await db.$transaction(async (tx) => {
      const created = await tx.recharge.create({
        data: {
          number: nextNumber,
          tenantId: tenantId!,
          supplierId,
          amount: subtotal,
          cost: total,
          profit: discount,
          notes: notes ?? null,
          items: {
            create: items.map((i) => {
              const p = productMap.get(i.productId)!
              return {
                productId: i.productId,
                productName: p.name,
                quantity: i.quantity,
                unitCost: i.unitCost,
                totalCost: i.unitCost * i.quantity,
              }
            }),
          },
        },
        include: { items: true },
      })

      // Update stock + create movements
      for (const item of items) {
        const product = productMap.get(item.productId)!
        const stockBefore = product.stock
        const stockAfter = stockBefore + item.quantity

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: stockAfter,
            ...(updateCostPrice ? { costPrice: item.unitCost } : {}),
          },
        })

        await tx.stockMovement.create({
          data: {
            type: "PURCHASE",
            quantity: item.quantity,
            stockBefore,
            stockAfter,
            unitCost: item.unitCost,
            totalCost: item.unitCost * item.quantity,
            reason: `Carga #${nextNumber}`,
            reference: created.id,
            productId: item.productId,
            userId: session.user.id!,
          },
        })
      }

      return created
    })

    return NextResponse.json({ recharge }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/cargas]", err)
    return NextResponse.json({ error: "Error al crear carga" }, { status: 500 })
  }
}
