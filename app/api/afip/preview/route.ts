import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import {
  chooseInvoiceType,
  computeIvaBreakdown,
  formatComprobanteNumber,
  type CondicionIVA,
} from "@/lib/afip"

/**
 * POST /api/afip/preview
 *
 * Given a draft sale (clientId + items), compute what the invoice WILL look
 * like once we request the CAE — without actually contacting AFIP. Useful for
 * the POS to confirm the user accepts the type/totals before committing.
 */
const PreviewSchema = z.object({
  clientId: z.string().nullable().optional(),
  customerCondicion: z.enum(["RI", "MONOTRIBUTO", "EXENTO", "CF"]).optional(),
  items: z.array(z.object({
    productName: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    subtotal: z.number().nonnegative(),
    taxRate: z.enum(["ZERO", "REDUCED", "STANDARD"]),
  })).min(1),
})

const RATES: Record<string, number> = { ZERO: 0, REDUCED: 0.105, STANDARD: 0.21 }

export async function POST(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = PreviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 422 })
  }
  const { clientId, items, customerCondicion } = parsed.data

  const cfg = await db.tenantConfig.findUnique({ where: { tenantId: tenantId! } })
  if (!cfg?.afipEnabled) {
    return NextResponse.json({ error: "AFIP no está habilitado para este negocio" }, { status: 400 })
  }
  if (!cfg.afipCondicionIVA || !cfg.afipCertCuit || !cfg.afipPointOfSale) {
    return NextResponse.json({ error: "Falta completar la configuración AFIP (CUIT, condición IVA, punto de venta)" }, { status: 400 })
  }

  let condicion: CondicionIVA = customerCondicion ?? "CF"
  let customerName = "Consumidor Final"
  if (clientId) {
    const client = await db.client.findUnique({ where: { id: clientId } })
    if (!client || client.tenantId !== tenantId) {
      return NextResponse.json({ error: "Cliente inválido" }, { status: 400 })
    }
    condicion = (client.condicionIVA as CondicionIVA) ?? "CF"
    customerName = client.name
  }

  const { letter, code } = chooseInvoiceType(cfg.afipCondicionIVA as CondicionIVA, condicion)

  const itemsWithRate = items.map((it) => ({
    ...it,
    taxRateNum: RATES[it.taxRate] ?? 0.21,
  }))
  const breakdown = computeIvaBreakdown(itemsWithRate.map((i) => ({ subtotal: i.subtotal, taxRate: i.taxRateNum })))
  const subtotalNeto = breakdown.reduce((s, b) => s + b.baseAmount, 0)
  const ivaTotal = breakdown.reduce((s, b) => s + b.ivaAmount, 0)
  const total = itemsWithRate.reduce((s, i) => s + i.subtotal, 0)

  // Predict the next invoice number (best-effort — AFIP itself owns the sequence)
  const last = await db.sale.findFirst({
    where: { tenantId: tenantId!, invoiceType: letter, pointOfSale: cfg.afipPointOfSale, invoiceNumber: { not: null } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  })
  const predictedNumber = (last?.invoiceNumber ?? 0) + 1

  return NextResponse.json({
    invoiceLetter: letter,
    invoiceCode: code,
    pointOfSale: cfg.afipPointOfSale,
    formattedNumber: formatComprobanteNumber(cfg.afipPointOfSale, predictedNumber),
    predictedNumber,
    customerName,
    customerCondicion: condicion,
    subtotalNeto: Math.round(subtotalNeto * 100) / 100,
    ivaTotal: Math.round(ivaTotal * 100) / 100,
    total: Math.round(total * 100) / 100,
    ivaBreakdown: breakdown,
    note: "Vista previa — el CAE se solicita al confirmar la venta.",
  })
}
