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
  whatsappPhone: z.string().optional().nullable(),
  whatsappLowStockAlerts: z.boolean().optional(),
  whatsappDailySummary: z.boolean().optional(),
  // Email notifications
  notificationEmail: z.string().email().optional().nullable().or(z.literal("")),
  emailLowStockAlerts: z.boolean().optional(),
  emailDailySummary: z.boolean().optional(),
  emailWeeklySummary: z.boolean().optional(),
  emailMonthlySummary: z.boolean().optional(),
  emailIncludeAIInsights: z.boolean().optional(),
  // Logo (URL string for now — direct upload coming soon)
  logoUrl: z.string().url("URL inválida").optional().nullable().or(z.literal("")),
  // Loyalty config
  loyaltyEnabled: z.boolean().optional(),
  loyaltyPointsPerPeso: z.number().nonnegative().optional(),
  loyaltyPointValue: z.number().nonnegative().optional(),
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
      | (typeof tenantConfig & {
          themeColor?: string | null
          themeMode?: string | null
          whatsappPhone?: string | null
          whatsappLowStockAlerts?: boolean | null
          whatsappDailySummary?: boolean | null
          logoUrl?: string | null
          loyaltyEnabled?: boolean | null
          loyaltyPointsPerPeso?: any
          loyaltyPointValue?: any
        })
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
        whatsappPhone: cfg?.whatsappPhone ?? null,
        whatsappLowStockAlerts: cfg?.whatsappLowStockAlerts ?? false,
        whatsappDailySummary: cfg?.whatsappDailySummary ?? false,
        notificationEmail: (cfg as any)?.notificationEmail ?? null,
        emailLowStockAlerts: (cfg as any)?.emailLowStockAlerts ?? false,
        emailDailySummary: (cfg as any)?.emailDailySummary ?? false,
        emailWeeklySummary: (cfg as any)?.emailWeeklySummary ?? false,
        emailMonthlySummary: (cfg as any)?.emailMonthlySummary ?? false,
        emailIncludeAIInsights: (cfg as any)?.emailIncludeAIInsights ?? true,
        logoUrl: cfg?.logoUrl ?? null,
        loyaltyEnabled: cfg?.loyaltyEnabled ?? false,
        loyaltyPointsPerPeso: cfg?.loyaltyPointsPerPeso != null ? Number(cfg.loyaltyPointsPerPeso) : 1,
        loyaltyPointValue: cfg?.loyaltyPointValue != null ? Number(cfg.loyaltyPointValue) : 1,
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

  // Build the theme + WhatsApp + logo + loyalty partial conditionally so DBs missing
  // the columns still accept writes for the legacy fields.
  const extraData: Record<string, unknown> = {}
  if (data.themeColor !== undefined) extraData.themeColor = data.themeColor || null
  if (data.themeMode !== undefined) extraData.themeMode = data.themeMode || null
  if (data.whatsappPhone !== undefined) extraData.whatsappPhone = data.whatsappPhone || null
  if (data.whatsappLowStockAlerts !== undefined) extraData.whatsappLowStockAlerts = data.whatsappLowStockAlerts
  if (data.whatsappDailySummary !== undefined) extraData.whatsappDailySummary = data.whatsappDailySummary
  if (data.notificationEmail !== undefined) extraData.notificationEmail = data.notificationEmail || null
  if (data.emailLowStockAlerts !== undefined) extraData.emailLowStockAlerts = data.emailLowStockAlerts
  if (data.emailDailySummary !== undefined) extraData.emailDailySummary = data.emailDailySummary
  if (data.emailWeeklySummary !== undefined) extraData.emailWeeklySummary = data.emailWeeklySummary
  if (data.emailMonthlySummary !== undefined) extraData.emailMonthlySummary = data.emailMonthlySummary
  if (data.emailIncludeAIInsights !== undefined) extraData.emailIncludeAIInsights = data.emailIncludeAIInsights
  if (data.logoUrl !== undefined) extraData.logoUrl = data.logoUrl ? data.logoUrl : null
  if (data.loyaltyEnabled !== undefined) extraData.loyaltyEnabled = data.loyaltyEnabled
  if (data.loyaltyPointsPerPeso !== undefined) extraData.loyaltyPointsPerPeso = data.loyaltyPointsPerPeso
  if (data.loyaltyPointValue !== undefined) extraData.loyaltyPointValue = data.loyaltyPointValue

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
          ...extraData,
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
          ...extraData,
        },
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[PUT /api/configuracion]", err)
    return NextResponse.json({ error: "Error al actualizar configuración" }, { status: 500 })
  }
}
