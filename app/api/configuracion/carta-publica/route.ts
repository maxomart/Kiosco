import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export const dynamic = "force-dynamic"

const saveSchema = z.object({
  enabled: z.boolean(),
  hours: z.string().max(120).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  whatsapp: z.string().max(20).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  showPrices: z.boolean().optional(),
})

export async function GET() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId! },
    select: {
      slug: true,
      config: {
        select: {
          publicStorefrontEnabled: true,
          publicHours: true,
          publicAddress: true,
          publicWhatsapp: true,
          publicDescription: true,
          publicShowPrices: true,
        } as any,
      },
    },
  })
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })
  const cfg = tenant.config as any
  return NextResponse.json({
    slug: tenant.slug,
    enabled: cfg?.publicStorefrontEnabled ?? false,
    hours: cfg?.publicHours ?? "",
    address: cfg?.publicAddress ?? "",
    whatsapp: cfg?.publicWhatsapp ?? "",
    description: cfg?.publicDescription ?? "",
    showPrices: cfg?.publicShowPrices ?? true,
  })
}

export async function PATCH(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 422 })
  }
  const data: any = {
    publicStorefrontEnabled: parsed.data.enabled,
    publicHours: parsed.data.hours || null,
    publicAddress: parsed.data.address || null,
    publicWhatsapp: parsed.data.whatsapp || null,
    publicDescription: parsed.data.description || null,
  }
  if (parsed.data.showPrices !== undefined) data.publicShowPrices = parsed.data.showPrices

  await db.tenantConfig.upsert({
    where: { tenantId: tenantId! },
    create: { tenantId: tenantId!, ...data },
    update: data,
  })
  return NextResponse.json({ ok: true })
}
