// scripts/ensure-promo.js
// Runs on every deploy (after ensure-admin). Creates the "lanzamiento" promo
// code if it doesn't exist. Idempotent: never resets usedCount, never changes
// an existing promo's settings — manage those via scripts/manage-promo.js.
//
// Override via env vars if you want a different launch promo:
//   LAUNCH_PROMO_CODE=lanzamiento
//   LAUNCH_PROMO_PLAN=PROFESSIONAL
//   LAUNCH_PROMO_DAYS=90
//   LAUNCH_PROMO_MAX=100
//   LAUNCH_PROMO_DESC="Lanzamiento — primeros 100…"

const { PrismaClient } = require("@prisma/client")

const VALID_PLANS = ["STARTER", "PROFESSIONAL", "BUSINESS"]

async function main() {
  const code = (process.env.LAUNCH_PROMO_CODE || "lanzamiento").trim().toLowerCase()
  const plan = process.env.LAUNCH_PROMO_PLAN || "PROFESSIONAL"
  const days = parseInt(process.env.LAUNCH_PROMO_DAYS || "90", 10)
  const max = parseInt(process.env.LAUNCH_PROMO_MAX || "100", 10)
  const description =
    process.env.LAUNCH_PROMO_DESC ||
    "Lanzamiento — primeros 100 reciben 3 meses de Profesional gratis"

  if (!VALID_PLANS.includes(plan)) {
    console.error(`[ensure-promo] LAUNCH_PROMO_PLAN inválido: ${plan}`)
    return
  }
  if (!Number.isInteger(days) || days <= 0 || !Number.isInteger(max) || max <= 0) {
    console.error("[ensure-promo] LAUNCH_PROMO_DAYS y LAUNCH_PROMO_MAX deben ser enteros positivos")
    return
  }

  const db = new PrismaClient()
  try {
    const existing = await db.promoCode.findUnique({ where: { code } })
    if (existing) {
      const remaining = existing.maxUses - existing.usedCount
      console.log(
        `[ensure-promo] ya existe: "${code}" · ${existing.planGranted} · ${existing.daysGranted}d · ${existing.usedCount}/${existing.maxUses} (${remaining} restantes) — no se modifica`
      )
      return
    }
    await db.promoCode.create({
      data: {
        code,
        planGranted: plan,
        daysGranted: days,
        maxUses: max,
        description,
        active: true,
      },
    })
    console.log(`[ensure-promo] creado: "${code}" · ${plan} · ${days}d · ${max} cupos`)
  } catch (err) {
    // Non-blocking: don't crash the deploy if promo creation fails — the rest
    // of the app should still boot. Operators can fix via manage-promo.js.
    console.error("[ensure-promo] error (non-blocking):", err.message)
  } finally {
    await db.$disconnect()
  }
}

main()
