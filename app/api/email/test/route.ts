import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { sendDigestForTenant, sendLowStockAlert } from "@/lib/digest-generator"

/**
 * POST /api/email/test
 * Body: { period: "daily" | "weekly" | "monthly" | "lowstock" }
 * Sends a test email to the tenant's configured notification address.
 */
export async function POST(req: Request) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["OWNER", "ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch { body = {} }
  const period = body?.period ?? "daily"

  let result: { sent: boolean; reason?: string }
  if (period === "lowstock") {
    result = await sendLowStockAlert(tenantId!)
  } else if (["daily", "weekly", "monthly"].includes(period)) {
    result = await sendDigestForTenant(tenantId!, period as "daily" | "weekly" | "monthly", { force: true })
  } else {
    return NextResponse.json({ error: "Período inválido" }, { status: 400 })
  }

  if (!result.sent) {
    const friendly: Record<string, string> = {
      tenant_inactive: "Cuenta inactiva",
      no_email: "No hay email configurado",
      none_low: "No hay productos con stock bajo en este momento",
      not_enabled: "La notificación no está activada (probá forzar)",
      no_sales_today: "No hay ventas hoy todavía",
    }
    return NextResponse.json(
      { error: friendly[result.reason ?? ""] ?? result.reason ?? "No se pudo enviar" },
      { status: 400 }
    )
  }

  // Audit log
  try {
    await db.auditLog.create({
      data: {
        action: "EMAIL_TEST",
        entity: "Tenant",
        entityId: tenantId!,
        userId: session.user.id!,
        newValue: JSON.stringify({ period }),
      },
    })
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, period })
}
