import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can, hasFeature } from "@/lib/permissions"
import { getTenantPlan } from "@/lib/plan-guard"
import { generateApiKey } from "@/lib/api-auth"

async function authorize() {
  const { error, tenantId, session, isSuperAdmin } = await getSessionTenant()
  if (error || !session) return { error: error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 }) }

  if (isSuperAdmin) return { tenantId: tenantId, session, allowed: true as const }

  if (!can(session.user.role, "billing:manage")) {
    return { error: NextResponse.json({ error: "Solo el dueño puede gestionar API keys" }, { status: 403 }) }
  }

  const plan = await getTenantPlan(tenantId!)
  if (!hasFeature(plan, "feature:api")) {
    return { error: NextResponse.json({ error: "API no disponible en tu plan", upgradeRequired: true }, { status: 402 }) }
  }
  return { tenantId, session, allowed: true as const }
}

export async function GET() {
  const auth = await authorize()
  if ("error" in auth && auth.error) return auth.error
  const { tenantId } = auth

  if (!tenantId) {
    // SUPER_ADMIN without a tenant — return empty list rather than error
    return NextResponse.json({ keys: [] })
  }

  const keys = await db.apiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, prefix: true, scopes: true,
      lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  })
  // hashedKey is intentionally NOT returned.
  return NextResponse.json({ keys })
}

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.enum(["read", "write"]).default("read"),
  expiresInDays: z.number().int().positive().max(3650).optional(),
})

export async function POST(req: NextRequest) {
  const auth = await authorize()
  if ("error" in auth && auth.error) return auth.error
  const { tenantId, session } = auth
  if (!tenantId || !session) {
    return NextResponse.json({ error: "Tenant requerido para crear API keys" }, { status: 400 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 422 })
  }

  const { raw, prefix, hashed } = generateApiKey()
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
    : null

  const created = await db.apiKey.create({
    data: {
      name: parsed.data.name,
      prefix,
      hashedKey: hashed,
      scopes: parsed.data.scopes,
      expiresAt,
      tenantId,
      createdById: session.user.id!,
    },
    select: {
      id: true, name: true, prefix: true, scopes: true,
      lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true,
    },
  })

  // RAW key returned ONCE — the user must copy it now.
  return NextResponse.json({ key: created, raw }, { status: 201 })
}
