import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const [tenant, tenantConfig] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId! }, select: { name: true } }),
    db.tenantConfig.findUnique({ where: { tenantId: tenantId! } }),
  ])

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
    },
  })
}

export async function PUT(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const body = await req.json()

  await db.$transaction([
    db.tenant.update({
      where: { id: tenantId! },
      data: {
        name: body.name?.trim() || undefined,
      },
    }),
    db.tenantConfig.upsert({
      where: { tenantId: tenantId! },
      create: {
        tenantId: tenantId!,
        businessName: body.name?.trim() || undefined,
        businessType: body.businessType || undefined,
        phone: body.phone || null,
        address: body.address || null,
        taxId: body.taxId || null,
        email: body.email || null,
        currency: body.currency ?? "ARS",
        timezone: body.timezone ?? "America/Argentina/Buenos_Aires",
      },
      update: {
        businessName: body.name?.trim() || undefined,
        businessType: body.businessType || undefined,
        phone: body.phone || null,
        address: body.address || null,
        taxId: body.taxId || null,
        email: body.email || null,
        currency: body.currency ?? "ARS",
        timezone: body.timezone ?? "America/Argentina/Buenos_Aires",
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
