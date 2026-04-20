import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { validateCUIT, normalizeCuit } from "@/lib/afip"

/**
 * PUT /api/afip/config
 * Persists the tenant's AFIP configuration (OWNER/ADMIN only).
 */
const Schema = z.object({
  afipEnabled: z.boolean(),
  afipMode: z.enum(["HOMOLOGACION", "PRODUCCION"]).default("HOMOLOGACION"),
  afipCondicionIVA: z.enum(["RI", "MONOTRIBUTO", "EXENTO"]).nullable().optional(),
  afipPointOfSale: z.number().int().positive().nullable().optional(),
  afipCertProvider: z.enum(["mock", "tusfacturas"]).nullable().optional(),
  afipCertCuit: z.string().nullable().optional(),
  afipCertSecret: z.string().nullable().optional(), // JSON string for TF: {apitoken,apikey,usertoken}
})

export async function PUT(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error
  const role = session!.user.role
  if (role !== "OWNER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 422 })
  }
  const d = parsed.data

  if (d.afipEnabled) {
    if (!d.afipCertCuit || !validateCUIT(d.afipCertCuit)) {
      return NextResponse.json({ error: "CUIT inválido" }, { status: 400 })
    }
    if (!d.afipCondicionIVA) {
      return NextResponse.json({ error: "Falta la condición IVA del emisor" }, { status: 400 })
    }
  }

  await db.tenantConfig.upsert({
    where: { tenantId: tenantId! },
    update: {
      afipEnabled: d.afipEnabled,
      afipMode: d.afipMode,
      afipCondicionIVA: d.afipCondicionIVA ?? null,
      afipPointOfSale: d.afipPointOfSale ?? 1,
      afipCertProvider: d.afipCertProvider ?? "mock",
      afipCertCuit: d.afipCertCuit ? normalizeCuit(d.afipCertCuit) : null,
      afipCertSecret: d.afipCertSecret ?? null,
    },
    create: {
      tenantId: tenantId!,
      afipEnabled: d.afipEnabled,
      afipMode: d.afipMode,
      afipCondicionIVA: d.afipCondicionIVA ?? null,
      afipPointOfSale: d.afipPointOfSale ?? 1,
      afipCertProvider: d.afipCertProvider ?? "mock",
      afipCertCuit: d.afipCertCuit ? normalizeCuit(d.afipCertCuit) : null,
      afipCertSecret: d.afipCertSecret ?? null,
    },
  })

  return NextResponse.json({ ok: true })
}
