import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * POST /api/auth/welcome/dismiss
 * Body: { plan: "STARTER" | "PROFESSIONAL" | "BUSINESS" | ... }
 *
 * Marca el lastWelcomedPlan del user al plan actual — usado por el
 * UpgradeWelcomeModal cuando el user lo cierra. La próxima vez que entre
 * al dashboard ya NO se re-monta el modal (a menos que upgrade otra vez).
 *
 * No tocamos tourCompletedAt — eso es del onboarding inicial. Acá solo
 * silenciamos el modal de upgrade para el plan actual.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  let body: { plan?: string } = {}
  try { body = await req.json() } catch { /* ok */ }

  // Validar contra el plan real del tenant — no confiamos en el body solo
  let plan = body.plan
  try {
    if (session.user.tenantId) {
      const sub = await db.subscription.findUnique({
        where: { tenantId: session.user.tenantId },
        select: { plan: true },
      })
      if (sub?.plan) plan = sub.plan
    }
  } catch { /* fallback al body */ }

  if (!plan) {
    return NextResponse.json({ error: "No se pudo determinar el plan" }, { status: 400 })
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { lastWelcomedPlan: plan },
  })

  return NextResponse.json({ ok: true, plan })
}
