/**
 * RetailAR — Bulk sync endpoint for offline POS sales.
 *
 * Body: { sales: [{ localId, payload, clientCreatedAt }] }
 * Returns: { results: [{ localId, ok, saleId?, error? }] }
 *
 * Idempotency:
 *   - Each sale carries a `localId` (UUID generated client-side).
 *   - We persist the localId into `Sale.notes` as `"[OFFLINE <localId>]"`
 *     so a retry of the same localId can be detected.
 *   - Before creating a sale, we check `Sale.notes contains [OFFLINE <localId>]`
 *     for this tenant and short-circuit with the existing sale id.
 *
 * Stock conflict:
 *   - If the offline sale would cause negative stock (a different
 *     cashier already sold the same product online), we return
 *     `{ ok: false, error: "Stock insuficiente: ..." }`. The client
 *     keeps the entry in IDB so the cashier can resolve it manually.
 *
 * Each sale is processed in its own transaction — one bad sale doesn't
 * poison the whole batch.
 */

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

const SalePayloadSchema = z.object({
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
}).passthrough() // tolerate extra _localId etc

const BulkSchema = z.object({
  sales: z.array(z.object({
    localId: z.string().min(1),
    payload: SalePayloadSchema,
    clientCreatedAt: z.number().optional(),
  })).min(1).max(50),
})

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = BulkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const userId = session!.user.id
  const tid = tenantId!
  const results: Array<{ localId: string; ok: boolean; saleId?: string; error?: string }> = []

  for (const entry of parsed.data.sales) {
    const { localId, payload, clientCreatedAt } = entry
    const tag = `[OFFLINE ${localId}]`

    try {
      // ---- Idempotency: same localId already synced? ----
      const existing = await db.sale.findFirst({
        where: { tenantId: tid, notes: { contains: tag } },
        select: { id: true },
      })
      if (existing) {
        results.push({ localId, ok: true, saleId: existing.id })
        continue
      }

      // ---- Cross-tenant validation for clientId / cashSessionId ----
      if (payload.clientId) {
        const c = await db.client.findUnique({
          where: { id: payload.clientId },
          select: { tenantId: true, creditLimit: true, currentBalance: true },
        })
        if (!c || c.tenantId !== tid) {
          results.push({ localId, ok: false, error: "Cliente inválido" })
          continue
        }
        if (payload.paymentMethod === "CUENTA_CORRIENTE") {
          const limit = Number(c.creditLimit ?? 0)
          const bal = Number(c.currentBalance ?? 0)
          if (limit > 0 && bal + payload.total > limit) {
            results.push({ localId, ok: false, error: "Excede límite de crédito del cliente" })
            continue
          }
        }
      } else if (payload.paymentMethod === "CUENTA_CORRIENTE") {
        results.push({ localId, ok: false, error: "Cuenta corriente requiere cliente" })
        continue
      }
      if (payload.cashSessionId) {
        const cs = await db.cashSession.findUnique({
          where: { id: payload.cashSessionId },
          select: { tenantId: true },
        })
        if (!cs || cs.tenantId !== tid) {
          // Sesión de caja del momento del offline ya cerró → no bloqueamos,
          // simplemente desvinculamos la venta.
          payload.cashSessionId = null
        }
      }

      const offlineNote = clientCreatedAt
        ? `${tag} ${new Date(clientCreatedAt).toISOString()} ${payload.notes ?? ""}`.trim()
        : `${tag} ${payload.notes ?? ""}`.trim()

      const created = await db.$transaction(async (tx) => {
        // Stock check inside tx — race-safe.
        for (const item of payload.items) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, tenantId: tid },
            select: { id: true, stock: true, name: true, soldByWeight: true },
          })
          if (!product) throw new Error(`Producto no encontrado: ${item.productName}`)
          if (!product.soldByWeight && product.stock < item.quantity) {
            throw new Error(
              `Stock insuficiente para "${item.productName}". Disponible: ${product.stock}, requerido: ${item.quantity}`
            )
          }
        }

        const last = await tx.sale.findFirst({
          where: { tenantId: tid }, orderBy: { number: "desc" }, select: { number: true },
        })
        const nextNumber = (last?.number ?? 0) + 1

        const sale = await tx.sale.create({
          data: {
            number: nextNumber,
            subtotal: payload.subtotal,
            discountAmount: payload.discountAmount,
            discountPercent: payload.discountPercent,
            taxAmount: payload.taxAmount,
            total: payload.total,
            paymentMethod: payload.paymentMethod,
            cashReceived: payload.cashReceived ?? null,
            change: payload.change ?? null,
            status: "COMPLETED",
            notes: offlineNote,
            tenantId: tid,
            userId,
            clientId: payload.clientId ?? null,
            cashSessionId: payload.cashSessionId ?? null,
          },
        })

        for (const item of payload.items) {
          const globalMultiplier = 1 - payload.discountPercent / 100
          const rate = TAX_RATES[item.taxRate] ?? 0
          const afterDiscount = item.subtotal * globalMultiplier
          const itemTaxAmount = afterDiscount * (rate / (1 + rate))

          await tx.saleItem.create({
            data: {
              saleId: sale.id,
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

          const cur = await tx.product.findUnique({
            where: { id: item.productId }, select: { stock: true },
          })
          const stockBefore = cur?.stock ?? 0
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

        if (payload.paymentMethod === "CUENTA_CORRIENTE" && payload.clientId) {
          await tx.client.update({
            where: { id: payload.clientId },
            data: { currentBalance: { increment: payload.total } },
          })
        }

        return sale
      })

      results.push({ localId, ok: true, saleId: created.id })
    } catch (err: any) {
      const msg = err?.message ?? "Error interno"
      results.push({ localId, ok: false, error: msg })
    }
  }

  return NextResponse.json({ results }, { status: 200 })
}
