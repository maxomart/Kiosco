import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { csvResponse, requireExportToken, monthLabelEs, fmtDate } from "@/lib/sheets-export"

export const dynamic = "force-dynamic"

/**
 * CSV de pagos (Invoices) para Google Sheets.
 * Una fila por invoice. Joinea con subscription → tenant → owner.
 */
export async function GET(req: NextRequest) {
  const auth = requireExportToken(req)
  if (auth) return auth

  const invoices = await db.invoice.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      createdAt: true,
      subscription: {
        select: {
          plan: true,
          paymentProvider: true,
          currentPeriodEnd: true,
          tenant: {
            select: {
              id: true,
              name: true,
              users: {
                where: { role: "OWNER" },
                select: { id: true, name: true, email: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  const methodLabel = (provider: string | null | undefined) => {
    if (!provider) return ""
    const p = provider.toLowerCase()
    if (p === "mercadopago" || p === "mp") return "MP"
    if (p === "stripe") return "Tarjeta"
    if (p === "transfer" || p === "transferencia") return "Transferencia"
    if (p === "cash" || p === "efectivo") return "Efectivo"
    return provider
  }

  const statusLabel = (s: string) => {
    const m: Record<string, string> = {
      PAID: "pagado",
      PENDING: "pendiente",
      FAILED: "fallido",
      REFUNDED: "reembolsado",
    }
    return m[s.toUpperCase()] ?? s.toLowerCase()
  }

  const rows = invoices.map((inv) => {
    const owner = inv.subscription?.tenant?.users?.[0]
    const dateForMonth = inv.paidAt ?? inv.createdAt
    return [
      inv.number || inv.id,
      owner?.id ?? "",
      owner?.name ?? "",
      owner?.email ?? "",
      inv.subscription?.tenant?.name ?? "",
      fmtDate(inv.paidAt ?? inv.createdAt),
      inv.subscription?.plan ?? "",
      `${inv.amount.toString()} ${inv.currency}`,
      methodLabel(inv.subscription?.paymentProvider ?? null),
      statusLabel(inv.status),
      fmtDate(inv.subscription?.currentPeriodEnd ?? null),
      monthLabelEs(dateForMonth),
    ]
  })

  return csvResponse(
    [
      "ID pago",
      "ID usuario",
      "Nombre",
      "Email",
      "Negocio",
      "Fecha pago",
      "Plan",
      "Monto",
      "Método",
      "Estado",
      "Próximo vencimiento",
      "Mes correspondiente",
    ],
    rows,
  )
}
