import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { generateInvoicePDF } from "@/lib/invoice-pdf"

/**
 * GET /api/ventas/[id]/factura
 * Streams the invoice PDF for a sale that already has CAE.
 * Tenant-scoped + auth.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const { id } = await params

  const sale = await db.sale.findUnique({
    where: { id },
    select: { id: true, tenantId: true, cae: true, number: true, invoiceType: true, pointOfSale: true, invoiceNumber: true },
  })
  if (!sale) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
  if (!isSuperAdmin && sale.tenantId !== tenantId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  if (!sale.cae) {
    return NextResponse.json({ error: "Esta venta no tiene factura electrónica todavía" }, { status: 409 })
  }

  const url = new URL(req.url)
  const copy = url.searchParams.get("copy") === "duplicado" ? "DUPLICADO" : "ORIGINAL"

  try {
    const pdf = await generateInvoicePDF(sale.id, copy)
    const filename = `factura-${sale.invoiceType ?? "X"}-${sale.pointOfSale ?? 0}-${sale.invoiceNumber ?? sale.number}.pdf`
    // Convert Node Buffer to Uint8Array for the Web Response API
    const u8 = new Uint8Array(pdf)
    return new NextResponse(u8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (e) {
    console.error("[GET /api/ventas/:id/factura]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error generando PDF" }, { status: 500 })
  }
}
