import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can, hasFeature } from "@/lib/permissions"
import { getTenantPlan } from "@/lib/plan-guard"

/**
 * Revoke an API key. We never hard-delete (audit trail); we set `revokedAt`
 * which `verifyApiKey()` checks on every request.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session, isSuperAdmin } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (!isSuperAdmin) {
    if (!can(session.user.role, "billing:manage")) {
      return NextResponse.json({ error: "Solo el dueño puede revocar API keys" }, { status: 403 })
    }
    const plan = await getTenantPlan(tenantId!)
    if (!hasFeature(plan, "feature:api")) {
      return NextResponse.json({ error: "API no disponible en tu plan" }, { status: 402 })
    }
  }

  const { id } = await ctx.params
  const key = await db.apiKey.findUnique({ where: { id }, select: { tenantId: true, revokedAt: true } })
  if (!key) return NextResponse.json({ error: "Clave no encontrada" }, { status: 404 })
  if (!isSuperAdmin && key.tenantId !== tenantId) {
    return NextResponse.json({ error: "Clave no encontrada" }, { status: 404 })
  }
  if (key.revokedAt) {
    return NextResponse.json({ ok: true, alreadyRevoked: true })
  }

  await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } })
  return NextResponse.json({ ok: true })
}
