import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["ADMIN", "OWNER", "SUPER_ADMIN"].includes(session.user.role ?? ""))
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason || "Anulación manual"

  const sale = await db.sale.findUnique({ where: { id: params.id }, include: { items: true } })
  if (!sale) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
  if (!isSuperAdmin && sale.tenantId !== tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  if (sale.status !== "COMPLETED") return NextResponse.json({ error: "Solo se pueden anular ventas completadas" }, { status: 400 })

  try {
    const updated = await db.$transaction(async (tx) => {
      const cancelled = await tx.sale.update({ where: { id: sale.id }, data: { status: "CANCELLED", cancelReason: reason } })
      for (const item of sale.items) {
        const product = await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } })
        await tx.stockMovement.create({
          data: { productId: item.productId, type: "RETURN", quantity: item.quantity, stockBefore: product.stock - item.quantity, stockAfter: product.stock, reason: `Anulación venta #${sale.number}`, reference: sale.id, userId: session.user.id! },
        })
      }
      await tx.auditLog.create({ data: { userId: session.user.id!, action: "CANCEL_SALE", entity: "Sale", entityId: sale.id, oldValue: '{"status":"COMPLETED"}', newValue: `{"status":"CANCELLED","reason":"${reason}"}` } })
      return cancelled
    })
    return NextResponse.json({ sale: updated })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error al anular" }, { status: 500 })
  }
}
