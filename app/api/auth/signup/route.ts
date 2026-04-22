import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { slugify } from "@/lib/utils"

const VALID_BUSINESS_TYPES = [
  "KIOSCO",
  "VERDULERIA",
  "MINISUPER",
  "FARMACIA",
  "OTRO",
] as const

const VALID_PLANS = ["FREE", "STARTER", "PROFESSIONAL", "BUSINESS"] as const

const signupSchema = z.object({
  businessName: z
    .string()
    .min(2, "El nombre del negocio debe tener al menos 2 caracteres.")
    .max(100, "El nombre del negocio es demasiado largo."),
  businessType: z.enum(VALID_BUSINESS_TYPES, {
    message: "Tipo de negocio inválido.",
  }),
  ownerName: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres.")
    .max(100, "El nombre es demasiado largo."),
  email: z
    .string()
    .email("Ingresá un email válido.")
    .max(200, "El email es demasiado largo."),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(128, "La contraseña es demasiado larga."),
  plan: z.enum(VALID_PLANS).optional().default("FREE"),
  promoCode: z.string().trim().toLowerCase().max(64).optional(),
})

function randomSuffix(len = 4): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + len)
    .padEnd(len, "0")
}

// Atomically reserve a slot on a promo code. Uses updateMany with a counter
// bound (usedCount < maxUses) so two concurrent signups can never push the
// counter past maxUses. Returns the promo snapshot if the claim succeeded,
// or null if the code is unavailable (agotado/vencido/inactivo/inexistente).
async function claimPromoSlot(code: string): Promise<{
  planGranted: string
  daysGranted: number
  promoId: string
} | null> {
  const promo = await db.promoCode.findUnique({
    where: { code },
    select: {
      id: true,
      active: true,
      expiresAt: true,
      planGranted: true,
      daysGranted: true,
      maxUses: true,
    },
  })

  if (!promo || !promo.active) return null
  if (promo.expiresAt && promo.expiresAt < new Date()) return null

  const claimed = await db.promoCode.updateMany({
    where: {
      id: promo.id,
      active: true,
      usedCount: { lt: promo.maxUses },
    },
    data: { usedCount: { increment: 1 } },
  })

  if (claimed.count !== 1) return null

  return {
    planGranted: promo.planGranted,
    daysGranted: promo.daysGranted,
    promoId: promo.id,
  }
}

// Rolls back the counter if the rest of the signup transaction fails.
async function refundPromoSlot(promoId: string): Promise<void> {
  try {
    await db.promoCode.update({
      where: { id: promoId },
      data: { usedCount: { decrement: 1 } },
    })
  } catch (e) {
    console.error("[SIGNUP_REFUND_PROMO]", e)
  }
}

export async function POST(req: Request) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { message: "Cuerpo de la solicitud inválido." },
        { status: 400 }
      )
    }

    // Validate with Zod
    const parsed = signupSchema.safeParse(body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((e) => ({
        path: e.path,
        message: e.message,
      }))
      return NextResponse.json({ errors }, { status: 422 })
    }

    const {
      businessName,
      businessType,
      ownerName,
      email,
      password,
      plan: requestedPlan,
      promoCode,
    } = parsed.data

    // Check if email already exists
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        { message: "Este email ya está registrado." },
        { status: 409 }
      )
    }

    // ── Claim promo slot BEFORE creating tenant ─────────────────
    // Atomic to prevent >100 claims on "los primeros 100". If the rest of
    // the transaction fails we refund the counter in the catch below.
    let promoApplied: { planGranted: string; daysGranted: number; promoId: string } | null = null
    if (promoCode) {
      promoApplied = await claimPromoSlot(promoCode)
      if (!promoApplied) {
        return NextResponse.json(
          {
            message:
              "El código promocional no es válido o se agotaron los cupos. Podés registrarte con cualquier plan igualmente.",
            code: "PROMO_UNAVAILABLE",
          },
          { status: 409 }
        )
      }
    }

    // If a promo was claimed, it overrides the requested plan.
    const plan = promoApplied ? promoApplied.planGranted : requestedPlan

    // Generate a unique tenant slug
    const baseSlug = slugify(businessName)
    let slug = `${baseSlug}-${randomSuffix(4)}`

    // Ensure slug uniqueness (retry once on collision)
    const slugExists = await db.tenant.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (slugExists) {
      slug = `${baseSlug}-${randomSuffix(6)}`
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    const now = new Date()
    const isPaidPlan = plan !== "FREE"

    let subscriptionStatus: string
    let periodEnd: Date | null

    if (promoApplied) {
      // Promo: plan ACTIVE (no trial flag), billing window = daysGranted.
      // No card on file — after periodEnd the tenant is downgraded to FREE
      // by the existing billing/cron logic (or manually until cron exists).
      subscriptionStatus = "ACTIVE"
      periodEnd = new Date(now.getTime() + promoApplied.daysGranted * 24 * 60 * 60 * 1000)
    } else if (isPaidPlan) {
      // Regular paid signup: 14-day trial.
      subscriptionStatus = "TRIALING"
      periodEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    } else {
      // FREE: permanent, no period end.
      subscriptionStatus = "ACTIVE"
      periodEnd = null
    }

    try {
      await db.$transaction(async (tx) => {
        // 1. Create Tenant
        const tenant = await tx.tenant.create({
          data: {
            name: businessName,
            slug,
          },
        })

        // 2. Create User (OWNER role)
        await tx.user.create({
          data: {
            name: ownerName,
            email,
            password: hashedPassword,
            role: "OWNER",
            tenantId: tenant.id,
          },
        })

        // 3. Create Subscription
        await tx.subscription.create({
          data: {
            plan,
            status: subscriptionStatus,
            tenantId: tenant.id,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        })

        // 4. Create TenantConfig with businessType
        await tx.tenantConfig.create({
          data: {
            businessName,
            businessType,
            tenantId: tenant.id,
          },
        })

        // 5. Record promo redemption for audit (if applicable)
        if (promoApplied) {
          await tx.promoRedemption.create({
            data: {
              promoCodeId: promoApplied.promoId,
              tenantId: tenant.id,
              email,
            },
          })
        }
      })
    } catch (txErr) {
      // Refund the claimed slot so future signups can still use it.
      if (promoApplied) await refundPromoSlot(promoApplied.promoId)
      throw txErr
    }

    return NextResponse.json(
      {
        ok: true,
        promoApplied: promoApplied
          ? { plan: promoApplied.planGranted, days: promoApplied.daysGranted }
          : null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("[SIGNUP_ERROR]", error)
    return NextResponse.json(
      { message: "Error interno del servidor. Intentá de nuevo." },
      { status: 500 }
    )
  }
}
