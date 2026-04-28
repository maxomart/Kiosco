import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { csvResponse, requireExportToken, monthLabelEs, fmtDate } from "@/lib/sheets-export"

export const dynamic = "force-dynamic"

/**
 * CSV de usuarios para Google Sheets (=IMPORTDATA en una celda).
 * Auth: ?token=SHEETS_EXPORT_TOKEN. Sólo OWNER de cada tenant — los empleados
 * no van a la planilla de billing.
 */
export async function GET(req: NextRequest) {
  const auth = requireExportToken(req)
  if (auth) return auth

  const owners = await db.user.findMany({
    where: { role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          config: { select: { businessType: true, phone: true } },
          subscription: {
            select: {
              currentPeriodStart: true,
              currentPeriodEnd: true,
              createdAt: true,
            },
          },
        },
      },
    },
  })

  const rows = owners.map((u) => {
    const sub = u.tenant?.subscription
    return [
      u.id,
      u.name,
      u.email,
      u.phone ?? u.tenant?.config?.phone ?? "",
      u.tenant?.name ?? "",
      u.tenant?.config?.businessType ?? "",
      fmtDate(u.createdAt),
      fmtDate(sub?.currentPeriodStart ?? sub?.createdAt ?? u.tenant?.createdAt ?? null),
      fmtDate(sub?.currentPeriodEnd ?? null),
    ]
  })

  return csvResponse(
    [
      "ID usuario",
      "Nombre",
      "Email",
      "Teléfono",
      "Negocio",
      "Tipo de negocio",
      "Fecha registro",
      "Fecha inicio prueba",
      "Fecha fin prueba",
    ],
    rows,
  )
}
