import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { verifyApiKey, hasScope, rateLimitHeaders } from "@/lib/api-auth"

const TAX_RATES: Record<string, number> = { ZERO: 0, REDUCED: 0.105, STANDARD: 0.21 }

/**
 * GET /api/v1/sales?from=2024-01-01&to=2024-12-31&paymentMethod=CASH&limit=50&offset=0
 */
export async function GET(req: NextRequest) {
  const verified = await verifyApiKey(req)
  if (!verified) {
    return NextResponse.json(
      { error: "Bearer token inválido o revocado" },
      { status: 401, headers: rateLimitHeaders() },
    )
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10), 1), 200)
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const paymentMethod = searchParams.get("paymentMethod")

  const where: Record<string, unknown> = { tenantId: verified.tenantId, status: "COMPLETED" }
  if (paymentMethod) where.paymentMethod = paymentMethod
  if (from || to) {
    const range: Record<string, Date> = {}
    if (from) range.gte = new Date(from)
    if (to) {
      const t = new Date(to)
      t.setHours(23, 59, 59, 999)
      range.lte = t
    }
    where.createdAt = range
  }

  const [items, total] = await Promise.all([
    db.sale.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, number: true, total: true, paymentMethod: true, createdAt: true,
        items: { select: { productName: true, quantity: true, unitPrice: true, subtotal: true } },
      },
    }),
    db.sale.count({ where }),
  ])

  const data = items.map((s) => ({
    id: s.id,
    number: s.number,
    total: Number(s.total),
    paymentMethod: s.paymentMethod,
    createdAt: s.createdAt,
    items: s.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      subtotal: Number(i.subtotal),
    })),
  }))

  return NextResponse.json(
    { data, pagination: { limit, offset, total } },
    { headers: rateLimitHeaders() },
  )
}

// ----- POST: create a sale via API (write scope required) -----

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
  notes: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  const verified = await verifyApiKey(req)
  if (!verified) {
    return NextResponse.json(
      { error: "Bearer token inválido o revocado" },
      { status: 401, headers: rateLimitHeaders() },
    )
  }
  if (!hasScope(verified, "write")) {
    return NextResponse.json(
      { error: "Esta API key no tiene permiso de escritura. Generá una nueva con scope=write." },
      { status: 403, headers: rateLimitHeaders() },
    )
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: rateLimitHeaders() })
  }
  const parsed = CreateSaleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 422, headers: rateLimitHeaders() },
    )
  }

  const data = parsed.data
  const tenantId = verified.tenantId

  // We need a userId on the Sale row. API-created sales are attributed to the
  // tenant's owner (first OWNER user). TODO: introduce a synthetic "API" user.
  const ownerUser = await db.user.findFirst({
    where: { tenantId, role: "OWNER", active: true },
    select: { id: true },
  })
  const apiUserId = ownerUser?.id
  if (!apiUserId) {
    return NextResponse.json(
      { error: "No se encontró usuario propietario para asociar la venta" },
      { status: 500, headers: rateLimitHeaders() },
    )
  }

  if (data.clientId) {
    const c = await db.client.findUnique({ where: { id: data.clientId }, select: { tenantId: true } })
    if (!c || c.tenantId !== tenantId) {
      return NextResponse.json({ error: "Cliente inválido" }, { status: 400, headers: rateLimitHeaders() })
    }
  }

  try {
    const sale = await db.$transaction(async (tx) => {
      for (const item of data.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId },
          select: { id: true, stock: true, name: true, soldByWeight: true },
        })
        if (!product) throw new Error(`Producto no encontrado: ${item.productId}`)
        if (!product.soldByWeight && product.stock < item.quantity) {
          throw new Error(`Stock insuficiente para "${item.productName}". Disponible: ${product.stock}`)
        }
      }

      const lastSale = await tx.sale.findFirst({
        where: { tenantId },
        orderBy: { number: "desc" },
        select: { number: true },
      })
      const nextNumber = (lastSale?.number ?? 0) + 1

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
          notes: data.notes ?? `[API] ${data.notes ?? ""}`.trim(),
          tenantId,
          userId: apiUserId,
          clientId: data.clientId ?? null,
        },
      })

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

        const cur = await tx.product.findUnique({ where: { id: item.productId }, select: { stock: true } })
        const before = cur?.stock ?? 0
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })
        await tx.stockMovement.create({
          data: {
            type: "SALE",
            quantity: item.quantity,
            stockBefore: before,
            stockAfter: before - item.quantity,
            unitCost: item.costPrice,
            totalCost: item.costPrice * item.quantity,
            reference: `API-VENTA-${nextNumber}`,
            productId: item.productId,
            userId: apiUserId,
          },
        })
      }

      return createdSale
    })

    return NextResponse.json(
      {
        data: {
          id: sale.id,
          number: sale.number,
          total: Number(sale.total),
          createdAt: sale.createdAt,
        },
      },
      { status: 201, headers: rateLimitHeaders() },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno"
    if (message.includes("Stock insuficiente") || message.includes("Producto no encontrado")) {
      return NextResponse.json({ error: message }, { status: 409, headers: rateLimitHeaders() })
    }
    console.error("[POST /api/v1/sales]", err)
    return NextResponse.json(
      { error: "Error al registrar venta" },
      { status: 500, headers: rateLimitHeaders() },
    )
  }
}
