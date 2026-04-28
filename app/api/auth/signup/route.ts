import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { slugify } from "@/lib/utils"
import { issueEmailCode, EMAIL_CODE_TTL_MIN } from "@/lib/email-verification"
import { sendEmail } from "@/lib/email"
import { renderEmailVerificationCode } from "@/lib/email-templates"
import { syncUserToSheet } from "@/lib/sheets-sync"

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
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, "Número de celular inválido. Usá formato +549XXXXXXXXXX"),
  plan: z.enum(VALID_PLANS).optional().default("FREE"),
  promoCode: z.string().trim().toLowerCase().max(64).optional(),
})

function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, "")
}

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
      phone: rawPhone,
      plan: requestedPlan,
      promoCode,
    } = parsed.data

    const phone = normalizePhone(rawPhone)

    // ── Existing-account checks ─────────────────────────────────────
    // Edge case: a user starts signup, the row is created with
    // emailVerified=null, then they bail (back button, closed tab) before
    // typing the verification code. The email + phone are now "taken" but
    // the account is unusable. We let them retry the signup as long as
    // the orphan is recent (< 24 h) — we'll wipe the tenant + user later
    // in the transaction below.
    const ORPHAN_TTL_HOURS = 24
    const orphanCutoff = new Date(Date.now() - ORPHAN_TTL_HOURS * 60 * 60 * 1000)

    let orphanIdsToWipe: { userId: string; tenantId: string | null }[] = []

    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true, tenantId: true, emailVerified: true, createdAt: true },
    })
    if (existing) {
      const isOrphan =
        !existing.emailVerified && existing.createdAt > orphanCutoff
      if (!isOrphan) {
        return NextResponse.json(
          { message: "Este email ya está registrado." },
          { status: 409 }
        )
      }
      orphanIdsToWipe.push({ userId: existing.id, tenantId: existing.tenantId })
    }

    const existingPhone = await db.user.findFirst({
      where: { phone },
      select: { id: true, tenantId: true, emailVerified: true, createdAt: true, email: true },
    })
    if (existingPhone) {
      const isOrphan =
        !existingPhone.emailVerified && existingPhone.createdAt > orphanCutoff
      if (!isOrphan) {
        return NextResponse.json(
          { message: "Este número de celular ya está registrado." },
          { status: 409 }
        )
      }
      // Avoid double-listing the same orphan when both email and phone
      // collisions point at the same row.
      if (!orphanIdsToWipe.some((o) => o.userId === existingPhone.id)) {
        orphanIdsToWipe.push({ userId: existingPhone.id, tenantId: existingPhone.tenantId })
      }
    }

    // Wipe orphans BEFORE we try to recreate (otherwise the unique
    // constraint will still bite). Best-effort — if any orphan delete
    // fails we abort and tell the user.
    if (orphanIdsToWipe.length > 0) {
      try {
        for (const o of orphanIdsToWipe) {
          // Tenant cascade takes care of the user too.
          if (o.tenantId) {
            await db.tenant.delete({ where: { id: o.tenantId } })
          } else {
            await db.user.delete({ where: { id: o.userId } })
          }
        }
      } catch (e) {
        console.error("[signup] orphan wipe failed:", e)
        return NextResponse.json(
          {
            message:
              "Hay un registro previo bloqueando este email. Esperá unos minutos o usá otro mail.",
          },
          { status: 409 }
        )
      }
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
      // Regular paid signup: 7-day trial.
      subscriptionStatus = "TRIALING"
      periodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    } else {
      // FREE: permanent, no period end.
      subscriptionStatus = "ACTIVE"
      periodEnd = null
    }

    let createdUserId: string | null = null
    try {
      await db.$transaction(async (tx) => {
        // 1. Create Tenant
        const tenant = await tx.tenant.create({
          data: {
            name: businessName,
            slug,
          },
        })

        // 2. Create User (OWNER role) — emailVerified intentionally null
        //    so the dashboard layout will bounce them to /verificar-email
        //    until they type the code we send below.
        const user = await tx.user.create({
          data: {
            name: ownerName,
            email,
            password: hashedPassword,
            phone,
            role: "OWNER",
            tenantId: tenant.id,
          },
        })
        createdUserId = user.id

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

    // Email verification — fire & forget the email but always return the
    // userId so the client can land on /verificar-email and either type
    // the code or hit "reenviar". Failure here doesn't roll back signup;
    // the user can always request another code from the verify page.
    if (createdUserId) {
      try {
        const codeRes = await issueEmailCode({ userId: createdUserId, force: true })
        if ("code" in codeRes) {
          const tpl = renderEmailVerificationCode({
            name: ownerName,
            code: codeRes.code,
            expiresInMin: EMAIL_CODE_TTL_MIN,
          })
          await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
          if (!process.env.RESEND_API_KEY) {
            console.log(`[signup] verification code for ${email}: ${codeRes.code}`)
          }
        }
      } catch (e) {
        console.error("[signup] failed to issue verification code:", e)
      }
    }

    // Notify the platform admin about the new signup. Best-effort,
    // doesn't block. Subject is sanitized to dodge header injection
    // even though businessName is regex-validated upstream.
    void notifyAdminOfSignup({
      businessName,
      businessType,
      ownerName,
      email,
      phone,
      plan,
      promoApplied: !!promoApplied,
    })

    // Push to Google Sheet "Usuarios" — fire & forget.
    if (createdUserId) syncUserToSheet(createdUserId)

    return NextResponse.json(
      {
        ok: true,
        userId: createdUserId,
        needsEmailVerification: true,
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

async function notifyAdminOfSignup(opts: {
  businessName: string
  businessType: string
  ownerName: string
  email: string
  phone: string
  plan: string
  promoApplied: boolean
}) {
  const adminEmail = process.env.SUPERADMIN_EMAIL ?? process.env.EMAIL_REPLY_TO
  if (!adminEmail) return
  const sanitize = (s: string) => s.replace(/[\r\n]+/g, " ").slice(0, 200)
  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  try {
    await sendEmail({
      to: adminEmail,
      subject: `[Orvex] Signup nuevo: ${sanitize(opts.businessName)} (${opts.plan})`,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">orvex · alta nueva</p>
        <h2 style="margin:6px 0 14px;color:#111827;font-size:18px;">${escapeHtml(opts.businessName)}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#111827;">
          <tr><td style="padding:6px 0;color:#6b7280;">Dueño</td><td style="padding:6px 0;text-align:right;">${escapeHtml(opts.ownerName)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Mail</td><td style="padding:6px 0;text-align:right;"><a href="mailto:${escapeHtml(opts.email)}" style="color:#2563eb;">${escapeHtml(opts.email)}</a></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Celular</td><td style="padding:6px 0;text-align:right;"><a href="https://wa.me/${escapeHtml(opts.phone.replace(/\D/g, ""))}" style="color:#2563eb;">${escapeHtml(opts.phone)}</a></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Tipo de negocio</td><td style="padding:6px 0;text-align:right;">${escapeHtml(opts.businessType)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Plan</td><td style="padding:6px 0;text-align:right;font-weight:600;">${opts.plan}${opts.promoApplied ? " (con promo)" : ""}</td></tr>
        </table>
        <p style="margin-top:16px;font-size:13px;color:#6b7280;">
          Mirá el detalle en <a href="${process.env.NEXTAUTH_URL ?? ""}/admin/tenants" style="color:#2563eb;">/admin/tenants</a>.
        </p>
      </div>`,
      text: `Signup nuevo: ${opts.businessName} (${opts.plan}${opts.promoApplied ? " con promo" : ""})\n\nDueño: ${opts.ownerName}\nMail: ${opts.email}\nCelular: ${opts.phone}\nTipo: ${opts.businessType}\n\nVer en /admin/tenants`,
    })
  } catch (e) {
    console.error("[signup] admin notification failed:", e)
  }
}
