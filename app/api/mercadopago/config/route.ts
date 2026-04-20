import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getTenantPlan } from "@/lib/plan-guard"
import { hasFeature } from "@/lib/permissions"

// GET / PUT MercadoPago credentials. Plan-gated PRO+.

const schema = z.object({
  mpAccessToken: z.string().optional().nullable(),
  mpPublicKey: z.string().optional().nullable(),
  mpUserId: z.string().optional().nullable(),
  mpStoreId: z.string().optional().nullable(),
})

async function gate(tenantId: string | null, isSuper: boolean) {
  if (isSuper) return true
  const plan = await getTenantPlan(tenantId!)
  return hasFeature(plan, "feature:loyalty")
}

export async function GET() {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  if (!(await gate(tenantId, isSuperAdmin))) {
    return NextResponse.json({ error: "Plan insuficiente" }, { status: 403 })
  }
  const cfg = await db.tenantConfig.findUnique({ where: { tenantId: tenantId! } })
  return NextResponse.json({
    config: {
      mpAccessToken: cfg?.mpAccessToken ? maskToken(cfg.mpAccessToken) : "",
      mpAccessTokenConfigured: !!cfg?.mpAccessToken,
      mpPublicKey: cfg?.mpPublicKey ?? "",
      mpUserId: cfg?.mpUserId ?? "",
      mpStoreId: cfg?.mpStoreId ?? "",
    },
  })
}

export async function PUT(req: NextRequest) {
  const { error, tenantId, session, isSuperAdmin } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const role = session.user.role
  if (!["SUPER_ADMIN", "OWNER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Permiso insuficiente" }, { status: 403 })
  }
  if (!(await gate(tenantId, isSuperAdmin))) {
    return NextResponse.json({ error: "Plan insuficiente" }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const data = parsed.data
  // Don't overwrite token if value is masked / empty
  const updateData: any = {}
  if (data.mpAccessToken && !data.mpAccessToken.includes("•")) {
    updateData.mpAccessToken = data.mpAccessToken
  }
  if (data.mpPublicKey !== undefined) updateData.mpPublicKey = data.mpPublicKey || null
  if (data.mpUserId !== undefined) updateData.mpUserId = data.mpUserId || null
  if (data.mpStoreId !== undefined) updateData.mpStoreId = data.mpStoreId || null

  await db.tenantConfig.upsert({
    where: { tenantId: tenantId! },
    update: updateData,
    create: { tenantId: tenantId!, ...updateData },
  })

  return NextResponse.json({ ok: true })
}

function maskToken(t: string) {
  if (t.length <= 12) return "•".repeat(t.length)
  return t.slice(0, 6) + "•".repeat(Math.max(8, t.length - 10)) + t.slice(-4)
}
