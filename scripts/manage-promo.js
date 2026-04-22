// scripts/manage-promo.js
// Create, reset, disable or inspect a promo code.
//
// Usage (from project root):
//   node scripts/manage-promo.js create lanzamiento PROFESSIONAL 90 100
//   node scripts/manage-promo.js reset lanzamiento           # resets usedCount to 0
//   node scripts/manage-promo.js disable lanzamiento         # soft-disable
//   node scripts/manage-promo.js enable lanzamiento
//   node scripts/manage-promo.js info lanzamiento
//   node scripts/manage-promo.js list

const { PrismaClient } = require("@prisma/client")

const VALID_PLANS = ["STARTER", "PROFESSIONAL", "BUSINESS"]

function usage() {
  console.log("Usage:")
  console.log("  node scripts/manage-promo.js create <code> <PLAN> <days> <maxUses> [description]")
  console.log("  node scripts/manage-promo.js reset <code>")
  console.log("  node scripts/manage-promo.js disable <code>")
  console.log("  node scripts/manage-promo.js enable <code>")
  console.log("  node scripts/manage-promo.js info <code>")
  console.log("  node scripts/manage-promo.js list")
  console.log(`\nValid plans: ${VALID_PLANS.join(", ")}`)
  process.exit(1)
}

function fmtPromo(p) {
  const remaining = p.maxUses - p.usedCount
  const status = !p.active
    ? "DISABLED"
    : p.expiresAt && p.expiresAt < new Date()
      ? "EXPIRED"
      : remaining <= 0
        ? "EXHAUSTED"
        : "ACTIVE"
  return `  [${status}] ${p.code}  →  ${p.planGranted} · ${p.daysGranted}d · ${p.usedCount}/${p.maxUses}  (${remaining} quedan)`
}

async function main() {
  const [, , action, codeArg, ...rest] = process.argv
  if (!action) usage()
  const code = (codeArg || "").trim().toLowerCase()
  const db = new PrismaClient()

  try {
    switch (action) {
      case "list": {
        const all = await db.promoCode.findMany({ orderBy: { createdAt: "desc" } })
        if (all.length === 0) {
          console.log("(sin promos)")
        } else {
          for (const p of all) console.log(fmtPromo(p))
        }
        break
      }
      case "info": {
        if (!code) usage()
        const p = await db.promoCode.findUnique({
          where: { code },
          include: { _count: { select: { redemptions: true } } },
        })
        if (!p) {
          console.log(`(no existe promo "${code}")`)
          break
        }
        console.log(fmtPromo(p))
        console.log(`  redemptions registered: ${p._count.redemptions}`)
        if (p.description) console.log(`  description: ${p.description}`)
        if (p.expiresAt) console.log(`  expiresAt: ${p.expiresAt.toISOString()}`)
        console.log(`  created: ${p.createdAt.toISOString()}`)
        break
      }
      case "create": {
        if (!code) usage()
        const [plan, daysStr, maxStr, ...descParts] = rest
        if (!VALID_PLANS.includes(plan)) {
          console.error(`Plan inválido. Válidos: ${VALID_PLANS.join(", ")}`)
          process.exit(1)
        }
        const days = Number(daysStr)
        const max = Number(maxStr)
        if (!Number.isInteger(days) || days <= 0) {
          console.error("days debe ser entero positivo")
          process.exit(1)
        }
        if (!Number.isInteger(max) || max <= 0) {
          console.error("maxUses debe ser entero positivo")
          process.exit(1)
        }
        const description = descParts.join(" ").trim() || null
        const existing = await db.promoCode.findUnique({ where: { code } })
        if (existing) {
          console.error(`Ya existe promo "${code}". Usá 'reset' para ponerla en 0 o 'disable' para deshabilitarla.`)
          process.exit(1)
        }
        const p = await db.promoCode.create({
          data: { code, planGranted: plan, daysGranted: days, maxUses: max, description },
        })
        console.log(`Creado:\n${fmtPromo(p)}`)
        break
      }
      case "reset": {
        if (!code) usage()
        const updated = await db.promoCode.update({
          where: { code },
          data: { usedCount: 0, active: true },
        })
        console.log(`Reset:\n${fmtPromo(updated)}`)
        break
      }
      case "disable": {
        if (!code) usage()
        const updated = await db.promoCode.update({
          where: { code },
          data: { active: false },
        })
        console.log(`Disabled:\n${fmtPromo(updated)}`)
        break
      }
      case "enable": {
        if (!code) usage()
        const updated = await db.promoCode.update({
          where: { code },
          data: { active: true },
        })
        console.log(`Enabled:\n${fmtPromo(updated)}`)
        break
      }
      default:
        usage()
    }
  } catch (err) {
    console.error("Error:", err.message)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

main()
