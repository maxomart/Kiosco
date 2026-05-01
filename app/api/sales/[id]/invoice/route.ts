import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { issueElectronicInvoice } from "@/lib/afip-issue"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  customerDocType: z.enum(["CUIT", "CUIL", "DNI", "EXTRANJERO", "SIN_IDENTIFICAR"]).optional(),
  customerDocNumber: z.string().max(15).optional(),
  customerCondicionIVA: z.enum(["RI", "MONOTRIBUTO", "EXENTO", "CF"]).optional(),
})

/**
 * POST /api/sales/:id/invoice
 *
 * Emite factura electrónica ARCA sobre una venta existente. Si pasan datos
 * del cliente (docType/docNumber/condición), se actualizan en la Sale antes
 * de emitir. Idempotente: si ya tiene CAE, devuelve los datos guardados.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  // Verificar que la venta pertenece al tenant
  const sale = await db.sale.findFirst({
    where: { id, tenantId: tenantId! },
    select: { id: true, cae: true, afipStatus: true },
  })
  if (!sale) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
  }

  // Body opcional con datos del cliente (sólo para B/A; C no requiere)
  let body: unknown = {}
  try { body = await req.json() } catch { /* sin body es OK */ }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 422 })
  }

  // Actualizar datos del cliente en la Sale si vinieron
  if (parsed.data.customerDocType || parsed.data.customerDocNumber || parsed.data.customerCondicionIVA) {
    await db.sale.update({
      where: { id },
      data: {
        ...(parsed.data.customerDocType ? { customerDocType: parsed.data.customerDocType } : {}),
        ...(parsed.data.customerDocNumber ? { customerDocNumber: parsed.data.customerDocNumber.replace(/\D/g, "") } : {}),
        ...(parsed.data.customerCondicionIVA ? { customerCondicionIVA: parsed.data.customerCondicionIVA } : {}),
      },
    })
  }

  const result = await issueElectronicInvoice(id)
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
