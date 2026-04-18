import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

// POST /api/ventas/[id]/anular
// Anula una venta y devuelve el stock a cada producto
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (!["ADMIN", "OWNER"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos para anular ventas" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason || "Anulación manual"

  const sale = await db.sale.findUnique({
    where: { id: params.id },
    include: { items: true },
  })

  if (!sale) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
  if (sale.status !== "COMPLETED") {
    return NextResponse.json({ error: "Solo se pueden anular ventas completadas" }, { status: 400 })
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      // 1. Marcar la venta como anulada
      const cancelled = await tx.sale.update({
        where: { id: sale.id },
        data: { status: "CANCELLED", cancelReason: reason },
      })

      // 2. Restaurar stock de cada ítem
      for (const item of sale.items) {
        const product = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        })

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "RETURN",
            quantity: item.quantity,
            stockBefore: product.stock - item.quantity,
            stockAfter: product.stock,
            reason: `Anulación venta #${sale.number}`,
            reference: sale.id,
            userId: session.user.id!,
          },
        })
      }

      // 3. Auditoría
      await tx.auditLog.create({
        data: {
          userId: session.user.id!,
          action: "CANCEL_SALE",
          entity: "Sale",
          entityId: sale.id,
          oldValue: JSON.stringify({ status: "COMPLETED" }),
          newValue: JSON.stringify({ status: "CANCELLED", cancelReason: reason }),
        },
      })

      return cancelled
    })

    return NextResponse.json({ sale: updated })
  } catch (err) {
    console.error("[/api/ventas/[id]/anular]", err)
    return NextResponse.json({ error: "Error al anular la venta" }, { status: 500 })
  }
}
