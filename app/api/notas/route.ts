import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * GET /api/notas
 *
 * Lista todas las notas (NC + ND) del tenant con paginación y filtros.
 *
 * Query params:
 *   page, limit, kind ("credit" | "debit"), from, to
 */
export async function GET(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "25", 10)))
  const kind = sp.get("kind") // "credit" | "debit" | null
  const from = sp.get("from") // ISO date
  const to = sp.get("to")

  const where: Record<string, unknown> = { tenantId: tenantId! }
  if (kind === "credit" || kind === "debit") where.kind = kind
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  const [rows, total] = await Promise.all([
    db.afipNote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sale: {
          select: {
            id: true,
            number: true,
            invoiceNumber: true,
            invoiceType: true,
            pointOfSale: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.afipNote.count({ where }),
  ])

  // KPIs en el periodo filtrado
  const kpis = await db.afipNote.groupBy({
    by: ["kind"],
    where,
    _sum: { amount: true },
    _count: { _all: true },
  })

  const summary = {
    credit: { count: 0, total: 0 },
    debit: { count: 0, total: 0 },
  }
  for (const k of kpis) {
    if (k.kind === "credit" || k.kind === "debit") {
      summary[k.kind] = {
        count: k._count._all,
        total: Number(k._sum.amount ?? 0),
      }
    }
  }

  return NextResponse.json({
    notes: rows.map((n) => ({
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
      sale: n.sale
        ? {
            id: n.sale.id,
            number: n.sale.number,
            invoiceNumber: n.sale.invoiceNumber,
            invoiceType: n.sale.invoiceType,
            pointOfSale: n.sale.pointOfSale,
            clientName: n.sale.client?.name ?? null,
          }
        : null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    summary,
  })
}
