import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

const TAX_RATES: Record<string, number> = {
  ZERO: 0,
  REDUCED: 0.105,
  STANDARD: 0.21,
}

const SaleItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative(),
  discount: z.number().min(0).max(100),
  subtotal: z.number().nonnegative(),
  taxRate: z.enum(["ZERO", "REDUCED", "STANDARD"]),
  soldByWeight: z.boolean().optional().default(false),
})

const CreateSaleSchema = z.object({
  items: z.array(SaleItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100),
  discountAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  paymentMethod: z.string().min(1),
  cashReceived: z.number().nonnegative().optional().nullable(),
  change: z.number().nonnegative().optional().nullable(),
  clientId: z.string().optional().nullable(),
  cashSessionId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = CreateSaleSchema.safeParse(body)
  if (!parsed.success) {
    console.error("[POST /api/ventas] validation failed", JSON.stringify(parsed.error.flatten(), null, 2))
    console.error("[POST /api/ventas] body received", JSON.stringify(body, null, 2))
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const data = parsed.data
  const userId = session!.user.id

  // Validate clientId / cashSessionId belong to tenant (prevents cross-tenant writes)
  if (data.clientId) {
    const client = await db.client.findUnique({ where: { id: data.clientId }, select: { tenantId: true } })
    if (!client || client.tenantId !== tenantId) {
      return NextResponse.json({ error: "Cliente inválido" }, { status: 400 })
    }
  }
  if (data.cashSessionId) {
    const cs = await db.cashSession.findUnique({ where: { id: data.cashSessionId }, select: { tenantId: true } })
    if (!cs || cs.tenantId !== tenantId) {
      return NextResponse.json({ error: "Sesión de caja inválida" }, { status: 400 })
    }
  }

  try {
    const sale = await db.$transaction(async (tx) => {
      // ---- 1. Stock check (inside transaction to prevent race conditions) ----
      for (const item of data.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId: tenantId! },
          select: { id: true, stock: true, name: true, soldByWeight: true },
        })

        if (!product) {
          throw new Error(`Producto no encontrado: ${item.productId}`)
        }

        // Weight-sold products may have fractional stock logic; skip integer check
        if (!product.soldByWeight && product.stock < item.quantity) {
          throw new Error(
            `Stock insuficiente para "${item.productName}". Disponible: ${product.stock}, requerido: ${item.quantity}`
          )
        }
      }

      // ---- 2. Get next sale number for tenant ----
      const lastSale = await tx.sale.findFirst({
        where: { tenantId: tenantId! },
        orderBy: { number: "desc" },
        select: { number: true },
      })
      const nextNumber = (lastSale?.number ?? 0) + 1

      // ---- 3. Create sale ----
      const createdSale = await tx.sale.create({
        data: {
          number: nextNumber,
          subtotal: data.subtotal,
          discountAmount: data.discountAmount,
          discountPercent: data.discountPercent,
          taxAmount: data.taxAmount,
          total: data.total,
          paymentMethod: data.paymentMethod,
          cashReceived: data.cashReceived ?? null,
          change: data.change ?? null,
          status: "COMPLETED",
          notes: data.notes ?? null,
          tenantId: tenantId!,
          userId,
          clientId: data.clientId ?? null,
          cashSessionId: data.cashSessionId ?? null,
        },
      })

      // ---- 4. Create sale items, decrement stock, create stock movements ----
      for (const item of data.items) {
        const globalMultiplier = 1 - data.discountPercent / 100
        const rate = TAX_RATES[item.taxRate] ?? 0
        const afterDiscount = item.subtotal * globalMultiplier
        const itemTaxAmount = afterDiscount * (rate / (1 + rate))

        await tx.saleItem.create({
          data: {
            saleId: createdSale.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice,
            discount: item.discount,
            subtotal: item.subtotal,
            taxRate: item.taxRate,
            taxAmount: Math.round(itemTaxAmount * 100) / 100,
          },
        })

        // Fetch current stock for movement log
        const currentProduct = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true },
        })

        const stockBefore = currentProduct?.stock ?? 0
        const stockAfter = stockBefore - item.quantity

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })

        await tx.stockMovement.create({
          data: {
            type: "SALE",
            quantity: item.quantity,
            stockBefore,
            stockAfter,
            unitCost: item.costPrice,
            totalCost: item.costPrice * item.quantity,
            reference: `VENTA-${nextNumber}`,
            productId: item.productId,
            userId,
          },
        })
      }

      // ---- 5. Loyalty points (1 point per peso, rounded) ----
      if (data.clientId) {
        const pointsEarned = Math.floor(data.total)
        if (pointsEarned > 0) {
          await tx.client.update({
            where: { id: data.clientId },
            data: { loyaltyPoints: { increment: pointsEarned } },
          })

          await tx.loyaltyTransaction.create({
            data: {
              points: pointsEarned,
              description: `Venta #${nextNumber}`,
              clientId: data.clientId,
              saleId: createdSale.id,
            },
          })
        }
      }

      return createdSale
    })

    // Return sale with items
    const fullSale = await db.sale.findUnique({
      where: { id: sale.id },
      include: {
        items: true,
        user: { select: { name: true } },
        client: { select: { name: true } },
      },
    })

    // Fire WhatsApp low-stock alert (best-effort, non-blocking).
    // We check products that JUST crossed below minStock as a result of
    // this sale, so we don't spam on every sale.
    void (async () => {
      try {
        const cfg = (await db.tenantConfig.findUnique({
          where: { tenantId: tenantId! },
        })) as any
        if (!cfg?.whatsappPhone || !cfg?.whatsappLowStockAlerts) return
        const productIds = data.items.map((i) => i.productId)
        const updated = await db.product.findMany({
          where: { id: { in: productIds } },
          select: { name: true, stock: true, minStock: true },
        })
        const justCrossed = updated.filter(
          (p: { stock: number; minStock: number }) =>
            p.stock <= p.minStock && p.stock >= 0
        )
        if (justCrossed.length === 0) return
        const tenant = await db.tenant.findUnique({
          where: { id: tenantId! },
          select: { name: true },
        })
        const { sendLowStockAlert } = await import("@/lib/whatsapp")
        await sendLowStockAlert(cfg.whatsappPhone, justCrossed, tenant?.name ?? "Tu negocio")
      } catch (e) {
        console.error("[ventas] WhatsApp alert failed", e)
      }
    })()

    return NextResponse.json({ sale: fullSale }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno"
    // Stock/business logic errors → 409 Conflict
    if (
      message.includes("Stock insuficiente") ||
      message.includes("Producto no encontrado")
    ) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    console.error("[POST /api/ventas]", err)
    return NextResponse.json({ error: "Error al registrar venta" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100)
  const skip = (page - 1) * limit

  const dateParam = searchParams.get("date")
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")

  let dateFilter: Record<string, Date> = {}
  if (dateParam) {
    const start = new Date(dateParam)
    start.setHours(0, 0, 0, 0)
    const end = new Date(dateParam)
    end.setHours(23, 59, 59, 999)
    dateFilter = { gte: start, lte: end }
  } else {
    if (fromParam) dateFilter.gte = new Date(fromParam)
    if (toParam) {
      const to = new Date(toParam)
      to.setHours(23, 59, 59, 999)
      dateFilter.lte = to
    }
  }

  const where = {
    tenantId: tenantId!,
    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
  }

  try {
    const [sales, total] = await Promise.all([
      db.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true } },
          client: { select: { name: true } },
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
            },
          },
        },
      }),
      db.sale.count({ where }),
    ])

    return NextResponse.json({
      sales,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error("[GET /api/ventas]", err)
    return NextResponse.json({ error: "Error al obtener ventas" }, { status: 500 })
  }
}
