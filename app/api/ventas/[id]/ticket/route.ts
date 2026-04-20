import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { generateReceiptPDF } from "@/lib/receipt-pdf"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const { id } = await params
  const sale = await db.sale.findUnique({ where: { id }, select: { tenantId: true } })
  if (!sale) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
  if (!isSuperAdmin && sale.tenantId !== tenantId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const buf = await generateReceiptPDF(id)
    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="ticket-${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (e: any) {
    console.error("[GET /api/ventas/[id]/ticket]", e)
    return NextResponse.json({ error: e?.message ?? "Error al generar ticket" }, { status: 500 })
  }
}
