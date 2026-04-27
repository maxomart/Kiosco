import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// POST /api/auth/tour/complete
// Body: { skipped?: boolean }
//
// Marks the current user's tour as done so the dashboard layout doesn't
// re-mount the overlay on the next visit. We also stamp lastWelcomedPlan
// to the user's current plan so the upgrade-welcome only fires when they
// move up later.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Body is optional — even an empty POST should mark complete.
  let body: { skipped?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    /* empty body is fine */
  }

  // Pull current plan to stamp lastWelcomedPlan. Best-effort — if the
  // subscription lookup fails we still mark the tour done so the user
  // isn't trapped in an endless tour loop.
  let currentPlan = "FREE"
  try {
    if (session.user.tenantId) {
      const sub = await db.subscription.findUnique({
        where: { tenantId: session.user.tenantId },
        select: { plan: true },
      })
      if (sub?.plan) currentPlan = sub.plan
    }
  } catch (e) {
    console.error("[tour/complete] subscription lookup failed:", e)
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      tourCompletedAt: new Date(),
      lastWelcomedPlan: currentPlan,
    },
  })

  return NextResponse.json({ ok: true, skipped: body.skipped ?? false })
}
