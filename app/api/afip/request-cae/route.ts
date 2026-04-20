import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getTenantPlan } from "@/lib/plan-guard"
import { hasFeature } from "@/lib/permissions"
import {
  chooseInvoiceType,
  computeIvaBreakdown,
  getAfipProvider,
  type CondicionIVA,
  type DocType,
} from "@/lib/afip"

/**
 * POST /api/afip/request-cae
 *
 * Body: { saleId: string }
 *
 * Idempotent: if the sale already has CAE = APPROVED, returns 200 with the
 * existing data. Otherwise calls the configured AFIP provider, persists the
 * result on the Sale row, and returns it.
 *
 * Plan gate:
 *   We use `feature:custom_logo` (STARTER+) as a proxy for AFIP access until
 *   we add a dedicated `feature:afip` to lib/permissions.ts. Same plans, same
 *   pricing tier — safe to swap later.
 *
 * Role gate: only OWNER / ADMIN may request CAE (CASHIER is read-only).
 */
const Schema = z.object({ saleId: z.string().min(1) })

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error
  const role = session!.user.role
  if (role !== "OWNER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo el dueño o un admin pueden solicitar CAE" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 422 })

  const plan = await getTenantPlan(tenantId!)
  // PROXY GATE — replace with `feature:afip` once added to lib/permissions.ts.
  if (!hasFeature(plan, "feature:custom_logo")) {
    return NextResponse.json({ error: "La facturación electrónica AFIP requiere plan Starter o superior." }, { status: 402 })
  }

  const sale = await db.sale.findUnique({
    where: { id: parsed.data.saleId },
    include: { items: true, client: true },
  })
  if (!sale || sale.tenantId !== tenantId) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
  }

  // Idempotent — already APPROVED.
  if (sale.afipStatus === "APPROVED" && sale.cae) {
    return NextResponse.json({
      ok: true,
      already: true,
      cae: sale.cae,
      caeExpiresAt: sale.caeExpiresAt,
      invoiceNumber: sale.invoiceNumber,
      invoiceType: sale.invoiceType,
      qrUrl: sale.afipQrUrl,
    })
  }

  const cfg = await db.tenantConfig.findUnique({ where: { tenantId: tenantId! } })
  if (!cfg?.afipEnabled) {
    return NextResponse.json({ error: "AFIP no está habilitado" }, { status: 400 })
  }
  const provider = getAfipProvider(cfg)
  if (!provider) {
    return NextResponse.json({ error: "Configuración AFIP incompleta o proveedor no válido" }, { status: 400 })
  }
  if (!cfg.afipCertCuit || !cfg.afipCondicionIVA || !cfg.afipPointOfSale) {
    return NextResponse.json({ error: "Falta CUIT, condición IVA o punto de venta" }, { status: 400 })
  }

  const TAX_RATES: Record<string, number> = { ZERO: 0, REDUCED: 0.105, STANDARD: 0.21 }
  const items = sale.items.map((i) => ({
    description: i.productName,
    quantity: i.quantity,
    unitPrice: Number(i.unitPrice),
    taxRate: TAX_RATES[i.taxRate] ?? 0.21,
    subtotal: Number(i.subtotal),
  }))
  const breakdown = computeIvaBreakdown(items)
  const subtotalNeto = breakdown.reduce((s, b) => s + b.baseAmount, 0)
  const ivaAmount = breakdown.reduce((s, b) => s + b.ivaAmount, 0)

  const customerCondicion: CondicionIVA = (sale.client?.condicionIVA as CondicionIVA) ?? "CF"
  const customerDocType: DocType = (sale.client?.docType as DocType) ?? "SIN_IDENTIFICAR"
  const customerDocNumber = sale.client?.docNumber ?? sale.client?.dni ?? "0"
  const customerName = sale.client?.name ?? "Consumidor Final"

  // Mark PENDING before calling — gives the UI something to show.
  await db.sale.update({
    where: { id: sale.id },
    data: { afipStatus: "PENDING", afipError: null },
  })

  const result = await provider.requestInvoice({
    emitterCuit: cfg.afipCertCuit,
    emitterCondicion: cfg.afipCondicionIVA as CondicionIVA,
    pointOfSale: cfg.afipPointOfSale,
    mode: (cfg.afipMode as "HOMOLOGACION" | "PRODUCCION") ?? "HOMOLOGACION",
    customerName,
    customerDocType,
    customerDocNumber,
    customerCondicion,
    customerAddress: sale.client?.address ?? undefined,
    saleId: sale.id,
    saleDate: sale.createdAt,
    currency: "PES",
    exchangeRate: 1,
    items,
    subtotalNeto,
    ivaAmount,
    total: Number(sale.total),
    ivaBreakdown: breakdown,
  })

  if (!result.ok) {
    await db.sale.update({
      where: { id: sale.id },
      data: { afipStatus: result.status, afipError: result.error ?? "Error desconocido" },
    })
    return NextResponse.json({ ok: false, error: result.error ?? "AFIP rechazó el comprobante", status: result.status }, { status: 502 })
  }

  const { letter } = chooseInvoiceType(cfg.afipCondicionIVA as CondicionIVA, customerCondicion)

  await db.sale.update({
    where: { id: sale.id },
    data: {
      cae: result.cae,
      caeExpiresAt: result.caeExpiresAt,
      invoiceNumber: result.invoiceNumber,
      pointOfSale: cfg.afipPointOfSale,
      invoiceType: letter,
      afipQrUrl: result.qrUrl,
      afipStatus: "APPROVED",
      afipError: null,
      customerDocType,
      customerDocNumber,
      customerCondicionIVA: customerCondicion,
    },
  })

  await db.tenantConfig.update({
    where: { tenantId: tenantId! },
    data: { afipLastSyncAt: new Date(), afipLastError: null },
  })

  return NextResponse.json({
    ok: true,
    cae: result.cae,
    caeExpiresAt: result.caeExpiresAt,
    invoiceNumber: result.invoiceNumber,
    invoiceType: letter,
    qrUrl: result.qrUrl,
  })
}
