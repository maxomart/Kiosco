import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { issueDebitNote } from "@/lib/afip-credit-note"

export const dynamic = "force-dynamic"

/**
 * POST /api/sales/:id/debit-note
 *
 * Emite nota de débito (cargo adicional) sobre una venta que ya tiene factura
 * electrónica emitida. NO cancela la venta — la factura original sigue válida.
 * Caso de uso típico: intereses por mora, ajustes posteriores.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo el dueño puede emitir notas de débito" }, { status: 403 })
  }

  const { id } = await params
  const sale = await db.sale.findFirst({
    where: { id, tenantId: tenantId! },
    select: { id: true, cae: true, status: true },
  })
  if (!sale) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
  if (!sale.cae) {
    return NextResponse.json({ error: "La venta no tiene factura electrónica original" }, { status: 400 })
  }

  const result = await issueDebitNote(id)
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
