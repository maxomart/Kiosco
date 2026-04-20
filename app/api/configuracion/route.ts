import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const [tenant, tenantConfig] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId! }, select: { name: true, businessType: true, phone: true, address: true, taxId: true } }),
    db.tenantConfig.findUnique({ where: { tenantId: tenantId! } }),
  ])

  return NextResponse.json({
    config: {
      name: tenant?.name ?? "",
      businessType: tenant?.businessType ?? "KIOSCO",
      phone: tenant?.phone ?? null,
      address: tenant?.address ?? null,
      taxId: tenant?.taxId ?? null,
      currency: tenantConfig?.currency ?? "ARS",
      timezone: tenantConfig?.timezone ?? "America/Argentina/Buenos_Aires",
      loyaltyEnabled: tenantConfig?.loyaltyEnabled ?? false,
      loyaltyPointsPerPeso: tenantConfig?.loyaltyPointsPerPeso ?? 1,
      loyaltyPointValue: tenantConfig?.loyaltyPointValue ?? 1,
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
        businessType: body.businessType || undefined,
        phone: body.phone || null,
        address: body.address || null,
        taxId: body.taxId || null,
      },
    }),
    db.tenantConfig.upsert({
      where: { tenantId: tenantId! },
      create: {
        tenantId: tenantId!,
        currency: body.currency ?? "ARS",
        timezone: body.timezone ?? "America/Argentina/Buenos_Aires",
        loyaltyEnabled: body.loyaltyEnabled ?? false,
        loyaltyPointsPerPeso: body.loyaltyPointsPerPeso ?? 1,
        loyaltyPointValue: body.loyaltyPointValue ?? 1,
      },
      update: {
        currency: body.currency ?? "ARS",
        timezone: body.timezone ?? "America/Argentina/Buenos_Aires",
        loyaltyEnabled: body.loyaltyEnabled ?? false,
        loyaltyPointsPerPeso: body.loyaltyPointsPerPeso ?? 1,
        loyaltyPointValue: body.loyaltyPointValue ?? 1,
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
