import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * GET /api/sales/:id/notes
 *
 * Lista las notas de crédito y débito emitidas sobre una venta.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) {
    return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  const sale = await db.sale.findFirst({
    where: { id, tenantId: tenantId! },
    select: { id: true },
  })
  if (!sale) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })

  const notes = await db.afipNote.findMany({
    where: { saleId: id, tenantId: tenantId! },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    notes: notes.map((n) => ({
      id: n.id,
      kind: n.kind,
      cae: n.cae,
      caeExpiresAt: n.caeExpiresAt,
      invoiceNumber: n.invoiceNumber,
      invoiceCode: n.invoiceCode,
      invoiceLetter: n.invoiceLetter,
      pointOfSale: n.pointOfSale,
      amount: Number(n.amount),
      concept: n.concept,
      qrUrl: n.qrUrl,
      createdAt: n.createdAt,
    })),
  })
}
