import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { issueDebitNote } from "@/lib/afip-credit-note"
import { getTenantPlan } from "@/lib/plan-guard"
import { hasFeature } from "@/lib/permissions"

export const dynamic = "force-dynamic"

const bodySchema = z
  .object({
    customAmount: z.number().positive().optional(),
    concept: z.string().min(1).max(200).optional(),
  })
  .optional()

/**
 * POST /api/sales/:id/debit-note
 *
 * Body opcional: { customAmount?: number, concept?: string }
 * - customAmount: monto de la ND. Si se omite, usa el total de la venta
 *   (poco realista — el caso típico es interés por mora, un fracción).
 * - concept: texto libre (ej "Intereses por mora", "Ajuste posterior").
 *
 * NO cancela la venta — la factura original sigue activa. La ND es un cargo
 * adicional asociado.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  let parsed: z.infer<typeof bodySchema> = undefined
  try {
    const raw = await req.json()
    parsed = bodySchema.parse(raw)
  } catch {
    parsed = undefined
  }

  // Plan gate: monto custom + concepto sólo Pro+. En Básico se ignora
  // silenciosamente y se emite ND por el total de la venta.
  const plan = await getTenantPlan(tenantId!)
  const allowCustom = hasFeature(plan, "feature:afip_nd_custom")

  const result = await issueDebitNote(id, {
    customAmount: allowCustom ? parsed?.customAmount : undefined,
    concept: allowCustom ? parsed?.concept : undefined,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
