import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// GET /api/promo/[code]
// Public endpoint — used by the signup page to validate a promo code in the URL
// and to render live counter ("quedan X de 100"). Returns a discriminated result
// so the UI can show the right message (invalid, agotado, vencido, ok).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const normalized = (code ?? "").trim().toLowerCase()

  if (!normalized || normalized.length > 64) {
    return NextResponse.json({ valid: false, reason: "invalid" }, { status: 200 })
  }

  const promo = await db.promoCode.findUnique({
    where: { code: normalized },
    select: {
      code: true,
      description: true,
      planGranted: true,
      daysGranted: true,
      maxUses: true,
      usedCount: true,
      active: true,
      expiresAt: true,
    },
  })

  if (!promo || !promo.active) {
    return NextResponse.json({ valid: false, reason: "not_found" }, { status: 200 })
  }

  const now = new Date()
  if (promo.expiresAt && promo.expiresAt < now) {
    return NextResponse.json({ valid: false, reason: "expired" }, { status: 200 })
  }

  const remaining = Math.max(0, promo.maxUses - promo.usedCount)
  if (remaining <= 0) {
    return NextResponse.json(
      {
        valid: false,
        reason: "exhausted",
        code: promo.code,
        planGranted: promo.planGranted,
        daysGranted: promo.daysGranted,
        maxUses: promo.maxUses,
        usedCount: promo.usedCount,
        remaining: 0,
      },
      { status: 200 }
    )
  }

  return NextResponse.json(
    {
      valid: true,
      code: promo.code,
      description: promo.description,
      planGranted: promo.planGranted,
      daysGranted: promo.daysGranted,
      maxUses: promo.maxUses,
      usedCount: promo.usedCount,
      remaining,
    },
    { status: 200 }
  )
}
