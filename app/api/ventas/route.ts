import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"

const saleItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  costPrice: z.number().min(0).default(0),
  discount: z.number().min(0).max(100).default(0),
  subtotal: z.number(),
  taxRate: z.enum(["ZERO", "REDUCED", "STANDARD"]).default("STANDARD"),
})

const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  subtotal: z.number(),
  discountAmount: z.number().default(0),
  discountPercent: z.number().default(0),
  taxAmount: z.number().default(0),
  total: z.number(),
  paymentMethod: z.enum([
    "CASH", "DEBIT", "CREDIT", "TRANSFER",
    "MERCADOPAGO", "UALA", "MODO", "NARANJA_X",
    "CUENTA_DNI", "LOYALTY_POINTS", "MIXED"
  ]).default("CASH"),
  cashReceived: z.number().optional(),
  change: z.number().optional(),
  clientId: z.string().optional().nullable(),
  cashSessionId: z.string().optional().nullable(),
  note: z.string().optional(),
  invoiceType: z.string().optional(),
})

// POST /api/ventas - Registrar una venta
export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error

  const body = await req.json()
  const parsed = saleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.errors }, { status: 400 })
  }

  const data = parsed.data

  try {
    // Verificar stock disponible
    for (const item of data.items) {
      const product = await db.product.findUnique({
        where: { id: item.productId },
        select: { stock: true, name: true, soldByWeight: true }
      })
      if (!product) {
        return NextResponse.json({ error: `Producto no encontrado: ${item.productId}` }, { status: 404 })
      }
      if (!product.soldByWeight && product.stock < item.quantity) {
        return NextResponse.json({
          error: `Stock insuficiente para: ${item.productName}. Stock actual: ${product.stock}`
        }, { status: 400 })
      }
    }

    // Calcular IVA por ítem
    const TAX_RATES = { ZERO: 0, REDUCED: 0.105, STANDARD: 0.21 }
    const itemsWithTax = data.items.map(item => ({
      ...item,
      taxAmount: item.subtotal * (TAX_RATES[item.taxRate] / (1 + TAX_RATES[item.taxRate])),
    }))

    // Crear la venta con todos sus ítems en una sola transacción
    const sale = await db.$transaction(async (tx) => {
      // Generar número de venta secuencial por tenant
      const lastSale = await tx.sale.findFirst({
        where: tenantId ? { tenantId } : {},
        orderBy: { number: "desc" },
        select: { number: true },
      })
      const nextNumber = (lastSale?.number ?? 0) + 1

      // 1. Crear la venta
      const newSale = await tx.sale.create({
        data: {
          number: nextNumber,
          subtotal: data.subtotal,
          discountAmount: data.discountAmount,
          discountPercent: data.discountPercent,
          taxAmount: data.taxAmount,
          total: data.total,
          paymentMethod: data.paymentMethod,
          cashReceived: data.cashReceived,
          change: data.change,
          clientId: data.clientId || null,
          cashSessionId: data.cashSessionId || null,
          userId: session!.user.id!,
          notes: data.note,
          invoiceType: data.invoiceType,
          tenantId: tenantId ?? null,
          items: {
            create: itemsWithTax.map(item => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              costPrice: item.costPrice,
              discount: item.discount,
              subtotal: item.subtotal,
              taxRate: item.taxRate,
              taxAmount: item.taxAmount,
            })),
          },
        },
        include: { items: true },
      })

      // 2. Actualizar stock de cada producto
      for (const item of data.items) {
        const product = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })

        // 3. Registrar movimiento de stock
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "SALE",
            quantity: -item.quantity,
            stockBefore: product.stock + item.quantity,
            stockAfter: product.stock,
            unitCost: item.costPrice,
            totalCost: item.costPrice * item.quantity,
            reference: newSale.id,
            userId: session!.user.id!,
          },
        })
      }

      // 4. Sumar puntos de fidelidad al cliente si aplica
      if (data.clientId) {
        const pointsEarned = Math.floor(data.total / 100) // 1 punto cada $100
        if (pointsEarned > 0) {
          await tx.client.update({
            where: { id: data.clientId },
            data: { loyaltyPoints: { increment: pointsEarned } },
          })
          await tx.loyaltyTransaction.create({
            data: {
              clientId: data.clientId,
              points: pointsEarned,
              description: `Compra #${newSale.number}`,
              saleId: newSale.id,
            },
          })
        }
      }

      return newSale
    })

    return NextResponse.json({ sale }, { status: 201 })
  } catch (err) {
    console.error("Error al procesar venta:", err)
    return NextResponse.json({ error: "Error al procesar la venta" }, { status: 500 })
  }
}

// GET /api/ventas - Listar ventas
export async function GET(req: NextRequest) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const date = searchParams.get("date") // YYYY-MM-DD — filtra por día exacto
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200)
  const page = parseInt(searchParams.get("page") ?? "1")

  const where: any = {}

  // Filtrar por tenant
  if (!isSuperAdmin) {
    where.tenantId = tenantId ?? undefined
  }

  if (date) {
    // Filtrar por día exacto: desde 00:00:00 hasta 23:59:59 del día indicado
    const dayStart = new Date(`${date}T00:00:00.000Z`)
    const dayEnd = new Date(`${date}T23:59:59.999Z`)
    where.createdAt = { gte: dayStart, lte: dayEnd }
  } else if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) where.createdAt.lte = new Date(to)
  }

  const [sales, total] = await Promise.all([
    db.sale.findMany({
      where,
      include: {
        user: { select: { name: true } },
        client: { select: { name: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    db.sale.count({ where }),
  ])

  return NextResponse.json({ sales, total, page, totalPages: Math.ceil(total / limit) })
}
