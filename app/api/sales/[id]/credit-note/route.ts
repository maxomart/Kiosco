import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { issueCreditNote } from "@/lib/afip-credit-note"
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
 * POST /api/sales/:id/credit-note
 *
 * Body opcional: { customAmount?: number, concept?: string }
 * - customAmount permite emitir NC parcial. Si se omite, se anula por el total.
 * - concept es texto libre que queda en el historial (AfipNote.concept).
 *
 * Marca la venta como CANCELLED y persiste la NC en AfipNote.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo el dueño puede emitir notas de crédito" }, { status: 403 })
  }

  const { id } = await params
  const sale = await db.sale.findFirst({
    where: { id, tenantId: tenantId! },
    select: { id: true, cae: true, status: true },
  })
  if (!sale) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
  if (sale.status === "CANCELLED") {
    return NextResponse.json({ error: "La venta ya está cancelada" }, { status: 409 })
  }
  if (!sale.cae) {
    return NextResponse.json({ error: "La venta no tiene factura electrónica — usá el flow normal de cancelación" }, { status: 400 })
  }

  // Body es opcional. Si no manda JSON, asumimos {}.
  let parsed: z.infer<typeof bodySchema> = undefined
  try {
    const raw = await req.json()
    parsed = bodySchema.parse(raw)
  } catch {
    parsed = undefined
  }

  // Plan gate: customAmount (NC parcial) sólo Pro+. En Básico se ignora
  // silenciosamente — emite por el total. Mismo criterio para `concept`
  // que va atado al feature avanzado.
  const plan = await getTenantPlan(tenantId!)
  const allowPartial = hasFeature(plan, "feature:afip_nc_partial")

  const result = await issueCreditNote(id, {
    customAmount: allowPartial ? parsed?.customAmount : undefined,
    concept: allowPartial ? parsed?.concept : undefined,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
