import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { generateNotePDF } from "@/lib/note-pdf"

export const dynamic = "force-dynamic"

/**
 * GET /api/sales/notes/:id/ticket
 *
 * Devuelve un PDF imprimible (80mm térmico) de la nota de crédito o débito.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const { id } = await params
  const note = await db.afipNote.findUnique({
    where: { id },
    select: { tenantId: true, kind: true, invoiceNumber: true },
  })
  if (!note) return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 })
  if (!isSuperAdmin && note.tenantId !== tenantId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const buf = await generateNotePDF(id)
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="nota-${note.kind}-${note.invoiceNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    console.error("[GET /api/sales/notes/[id]/ticket]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al generar el comprobante" },
      { status: 500 },
    )
  }
}
