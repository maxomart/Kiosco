import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can, hasFeature } from "@/lib/permissions"
import { getTenantPlan } from "@/lib/plan-guard"

const updatesSchema = z.object({
  /** "SET" (default, replaces value) or "ADD" (sums to current — for stock arrivals). */
  mode: z.enum(["SET", "ADD"]).optional().default("SET"),
  /** Optional reference label saved on each StockMovement (e.g. "Carga 12/04/2026") */
  reference: z.string().nullable().optional(),
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        salePrice: z.number().min(0).optional(),
        costPrice: z.number().min(0).optional(),
        stock: z.number().int().optional(),       // signed in ADD mode (can be negative for adjustments)
      }),
    )
    .min(1, "Sin cambios para guardar"),
})

const deleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) })

// POST — bulk update prices / stock (SET or ADD)
export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (!can(session.user.role, "products:edit")) {
    return NextResponse.json({ error: "Sin permisos para editar productos" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = updatesSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    const msg = firstIssue?.message ?? "Datos inválidos"
    console.error("[bulk] validation failed:", JSON.stringify(parsed.error.issues))
    return NextResponse.json({ error: msg, detail: parsed.error.issues }, { status: 400 })
  }
  const { mode, updates, reference } = parsed.data

  try {
    // Verify all products belong to tenant + load current stock if ADD mode
    const ids = updates.map((u) => u.id)
    const products = await db.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, tenantId: true, stock: true, costPrice: true, name: true },
    })
    if (products.length !== ids.length)
      return NextResponse.json({ error: "Algún producto no encontrado" }, { status: 404 })
    const invalid = products.filter((p: { tenantId: string }) => p.tenantId !== tenantId)
    if (invalid.length > 0) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

    const productById = new Map(products.map((p: any) => [p.id, p]))

    // Run everything in a single transaction. For ADD mode we also create a
    // StockMovement so the change is auditable + impacts cash flow if costPrice
    // is provided (treat as PURCHASE).
    const ops: any[] = []
    let withStockChange = 0

    for (const u of updates) {
      const p = productById.get(u.id) as any
      const data: Record<string, unknown> = {}

      if (u.salePrice !== undefined) data.salePrice = u.salePrice
      if (u.costPrice !== undefined) data.costPrice = u.costPrice

      if (u.stock !== undefined) {
        if (mode === "ADD") {
          data.stock = { increment: u.stock }
        } else {
          if (u.stock < 0) continue // SET mode rejects negative stock silently
          data.stock = u.stock
        }

        // Audit: stock movement
        const stockBefore = p.stock as number
        const stockAfter = mode === "ADD" ? stockBefore + u.stock : u.stock
        const delta = stockAfter - stockBefore

        if (delta !== 0) {
          withStockChange++
          ops.push(
            db.stockMovement.create({
              data: {
                type: delta > 0 ? "PURCHASE" : "ADJUSTMENT",
                quantity: Math.abs(delta),
                stockBefore,
                stockAfter,
                unitCost: u.costPrice ?? Number(p.costPrice ?? 0),
                totalCost:
                  (u.costPrice ?? Number(p.costPrice ?? 0)) * Math.abs(delta),
                reason: mode === "ADD" ? "Carga masiva" : "Ajuste manual masivo",
                reference: reference ?? null,
                productId: u.id,
                userId: session.user.id!,
              },
            }),
          )
        }
      }

      ops.push(db.product.update({ where: { id: u.id }, data }))
    }

    await db.$transaction(ops)
    return NextResponse.json({
      updated: updates.length,
      stockMovements: withStockChange,
      mode,
    })
  } catch (err) {
    console.error("[POST /api/productos/bulk]", err)
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

// DELETE — bulk delete
export async function DELETE(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (!can(session.user.role, "products:delete")) {
    return NextResponse.json({ error: "Sin permisos para eliminar productos" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Sin IDs" }, { status: 400 })
  const { ids } = parsed.data

  try {
    const result = await db.product.updateMany({
      where: { id: { in: ids }, tenantId: tenantId! },
      data: { active: false },
    })
    return NextResponse.json({ deleted: result.count })
  } catch (err) {
    console.error("[DELETE /api/productos/bulk]", err)
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}
