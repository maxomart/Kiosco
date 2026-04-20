import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

const HEX = /^#[0-9a-fA-F]{6}$/

const putSchema = z.object({
  name: z.string().min(1).optional(),
  businessType: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  themeColor: z.string().regex(HEX, "Color inválido").optional().nullable(),
  themeMode: z.enum(["dark", "light", "auto"]).optional().nullable(),
})

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  try {
    const [tenant, tenantConfig] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenantId! }, select: { name: true } }),
      db.tenantConfig.findUnique({ where: { tenantId: tenantId! } }),
    ])

    const cfg = tenantConfig as
      | (typeof tenantConfig & { themeColor?: string | null; themeMode?: string | null })
      | null

    return NextResponse.json({
      config: {
        name: tenant?.name ?? "",
        businessType: tenantConfig?.businessType ?? "KIOSCO",
        phone: tenantConfig?.phone ?? null,
        address: tenantConfig?.address ?? null,
        taxId: tenantConfig?.taxId ?? null,
        email: tenantConfig?.email ?? null,
        currency: tenantConfig?.currency ?? "ARS",
        timezone: tenantConfig?.timezone ?? "America/Argentina/Buenos_Aires",
        themeColor: cfg?.themeColor ?? null,
        themeMode: cfg?.themeMode ?? "dark",
      },
    })
  } catch (err) {
    console.error("[GET /api/configuracion]", err)
    return NextResponse.json({ error: "Error al obtener configuración" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const data = parsed.data
  const email = data.email ? data.email : null

  // Build the theme partial conditionally so DBs missing the columns
  // still accept writes for the legacy fields.
  const themeData: Record<string, unknown> = {}
  if (data.themeColor !== undefined) themeData.themeColor = data.themeColor || null
  if (data.themeMode !== undefined) themeData.themeMode = data.themeMode || null

  try {
    await db.$transaction([
      db.tenant.update({
        where: { id: tenantId! },
        data: {
          name: data.name?.trim() || undefined,
        },
      }),
      db.tenantConfig.upsert({
        where: { tenantId: tenantId! },
        create: {
          tenantId: tenantId!,
          businessName: data.name?.trim() || undefined,
          businessType: data.businessType || undefined,
          phone: data.phone || null,
          address: data.address || null,
          taxId: data.taxId || null,
          email,
          currency: data.currency ?? "ARS",
          timezone: data.timezone ?? "America/Argentina/Buenos_Aires",
          ...themeData,
        },
        update: {
          businessName: data.name?.trim() || undefined,
          businessType: data.businessType || undefined,
          phone: data.phone || null,
          address: data.address || null,
          taxId: data.taxId || null,
          email,
          currency: data.currency ?? "ARS",
          timezone: data.timezone ?? "America/Argentina/Buenos_Aires",
          ...themeData,
        },
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[PUT /api/configuracion]", err)
    return NextResponse.json({ error: "Error al actualizar configuración" }, { status: 500 })
  }
}
