/**
 * Daily cron: send WhatsApp reminders to tenants whose promo window is
 * about to expire. Three thresholds:
 *   - 30 days left  → first friendly nudge (remindersSent 0 → 1)
 *   - 10 days left  → urgency nudge          (1 → 2)
 *   - 1 day left    → last-chance nudge      (2 → 3)
 *
 * Only fires for tenants who:
 *   - Have a PromoRedemption (were granted a promo plan at signup)
 *   - Still on the paid plan (weren't already downgraded)
 *   - Haven't added a paymentProvider (didn't convert to paid yet)
 *   - Have whatsappPhone configured in TenantConfig
 *
 * `remindersSent` prevents double-sending when the cron ticks multiple times
 * in the same threshold window.
 *
 * Wiring (Railway/Vercel): GET/POST /api/cron/promo-reminders daily at 10:00
 *   with header: Authorization: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyCronSecret } from "@/lib/cron"
import { sendWhatsApp, isWhatsAppConfigured } from "@/lib/whatsapp"
import { PLAN_LABELS_AR } from "@/lib/utils"

interface ReminderThreshold {
  daysLeftMax: number // if daysLeft <= this and > next lower threshold
  level: 1 | 2 | 3
  copyFor: (args: { plan: string; daysLeft: number; appUrl: string }) => string
}

// Order matters: checked top-down, we stop at the first match.
const THRESHOLDS: ReminderThreshold[] = [
  {
    daysLeftMax: 1,
    level: 3,
    copyFor: ({ plan, appUrl }) =>
      `🚨 Último día de ${plan} gratis en RetailAR.\n\n` +
      `Mañana tu cuenta pasa a Gratis y perdés IA, multi-usuario y fidelización. ` +
      `Activá tu suscripción en menos de 1 minuto acá:\n${appUrl}/configuracion/suscripcion\n\n` +
      `Si ya decidiste no continuar, ¡gracias por haberla usado!`,
  },
  {
    daysLeftMax: 10,
    level: 2,
    copyFor: ({ plan, daysLeft, appUrl }) =>
      `⏳ Te quedan ${daysLeft} días de ${plan} gratis en RetailAR.\n\n` +
      `Para seguir con todas las features activas, suscribite acá antes del vencimiento:\n${appUrl}/configuracion/suscripcion\n\n` +
      `Si querés darnos feedback, respondé a este WhatsApp — lo leo yo.`,
  },
  {
    daysLeftMax: 30,
    level: 1,
    copyFor: ({ plan, daysLeft, appUrl }) =>
      `👋 Hola! Ya pasó más de la mitad de tu prueba de ${plan} gratis en RetailAR.\n\n` +
      `Te quedan ${daysLeft} días. Si te está sirviendo, podés pasar a plan pago cuando quieras: ${appUrl}/configuracion/suscripcion\n\n` +
      `¿Qué funciona? ¿Qué falta? Respondeme acá — cualquier feedback ayuda.`,
  },
]

function thresholdFor(daysLeft: number, already: number): ReminderThreshold | null {
  for (const t of THRESHOLDS) {
    if (daysLeft <= t.daysLeftMax && already < t.level) return t
  }
  return null
}

async function run(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 })
  }

  const wspConfigured = isWhatsAppConfigured()
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ""

  const now = new Date()
  const redemptions = await db.promoRedemption.findMany({
    select: {
      id: true,
      tenantId: true,
      email: true,
      remindersSent: true,
      promoCode: { select: { planGranted: true } },
    },
  })

  if (redemptions.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, notified: 0 })
  }

  const results: Array<{ tenantId: string; level: number; channel: string; ok: boolean; reason?: string }> = []

  for (const r of redemptions) {
    // Already sent the final reminder? nothing more to do.
    if (r.remindersSent >= 3) continue

    const sub = await db.subscription.findUnique({
      where: { tenantId: r.tenantId },
      select: { plan: true, currentPeriodEnd: true, paymentProvider: true },
    })
    if (!sub) continue
    if (sub.plan === "FREE") continue // already downgraded
    if (sub.paymentProvider) continue // converted, don't spam
    if (!sub.currentPeriodEnd) continue

    const msLeft = sub.currentPeriodEnd.getTime() - now.getTime()
    const daysLeft = Math.ceil(msLeft / 86_400_000)
    if (daysLeft < 0) continue // already expired — expire-promos handles it

    const threshold = thresholdFor(daysLeft, r.remindersSent)
    if (!threshold) continue

    const planLabel = PLAN_LABELS_AR[r.promoCode.planGranted as keyof typeof PLAN_LABELS_AR] ?? r.promoCode.planGranted

    // Where do we send? Prefer tenant's configured whatsappPhone.
    const cfg = await db.tenantConfig.findUnique({
      where: { tenantId: r.tenantId },
      select: { whatsappPhone: true },
    })

    const copy = threshold.copyFor({ plan: planLabel, daysLeft: Math.max(1, daysLeft), appUrl })

    let delivered = false
    let reason: string | undefined

    if (wspConfigured && cfg?.whatsappPhone) {
      const sendRes = await sendWhatsApp(cfg.whatsappPhone, copy)
      delivered = sendRes.ok
      if (!sendRes.ok) reason = sendRes.error
      results.push({ tenantId: r.tenantId, level: threshold.level, channel: "whatsapp", ok: sendRes.ok, reason })
    } else {
      // No WhatsApp available → log only. Email channel can plug in here later.
      reason = !wspConfigured ? "whatsapp_not_configured" : "tenant_missing_whatsapp_phone"
      results.push({ tenantId: r.tenantId, level: threshold.level, channel: "none", ok: false, reason })
    }

    // Bump the counter even if delivery failed — otherwise we'd retry forever
    // on the same tenant. Delivery failure is visible in the result array for
    // audit / retry decisions operators can make later.
    if (delivered || !wspConfigured) {
      await db.promoRedemption.update({
        where: { id: r.id },
        data: { remindersSent: threshold.level },
      })
    }
  }

  return NextResponse.json({
    ok: true,
    checked: redemptions.length,
    notified: results.filter((x) => x.ok).length,
    details: results,
    ranAt: now.toISOString(),
  })
}

export async function POST(req: NextRequest) {
  return run(req)
}
export async function GET(req: NextRequest) {
  return run(req)
}
