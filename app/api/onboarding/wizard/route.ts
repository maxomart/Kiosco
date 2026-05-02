import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * Wizard interactivo de 5 pasos. GET devuelve estado actual.
 * Pasos:
 *   1. product   → cargar primer producto
 *   2. cash      → abrir caja
 *   3. sale      → hacer primera venta
 *   4. report    → abrir página de reportes
 *   5. logo      → subir logo + nombre del negocio
 */
export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error || !tenantId) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const [config, productsCount, cashCount, salesCount] = await Promise.all([
    db.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        businessName: true,
        logoUrl: true,
        wizardCompletedAt: true,
        wizardSeenReports: true,
      } as any,
    }),
    db.product.count({ where: { tenantId, active: true } }),
    db.cashSession.count({ where: { tenantId } }),
    db.sale.count({ where: { tenantId, status: "COMPLETED" } }),
  ])

  const cfg = config as any
  const steps = {
    product: productsCount > 0,
    cash: cashCount > 0,
    sale: salesCount > 0,
    report: cfg?.wizardSeenReports ?? false,
    logo: !!(cfg?.businessName && cfg?.logoUrl),
  }
  const completedCount = Object.values(steps).filter(Boolean).length
  const allDone = completedCount === 5

  return NextResponse.json({
    completedAt: cfg?.wizardCompletedAt ?? null,
    steps,
    completedCount,
    allDone,
  })
}

const postSchema = z.object({
  action: z.enum(["complete", "skip", "markReportsSeen"]),
})

export async function POST(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error || !tenantId) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Acción inválida" }, { status: 400 })

  const data: any = {}
  if (parsed.data.action === "complete" || parsed.data.action === "skip") {
    data.wizardCompletedAt = new Date()
  } else if (parsed.data.action === "markReportsSeen") {
    data.wizardSeenReports = true
  }

  await db.tenantConfig.upsert({
    where: { tenantId },
    update: data,
    create: { tenantId, ...data },
  })

  return NextResponse.json({ ok: true })
}
