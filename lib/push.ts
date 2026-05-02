/**
 * Web Push helpers — wrapper de la lib `web-push` con las VAPID keys del SaaS.
 *
 * Setup (una sola vez):
 *   - Generar VAPID keys: `npx web-push generate-vapid-keys`
 *   - Setear NEXT_PUBLIC_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en Railway
 *   - El subject puede ser tu mail (mailto:cobraorvex@gmail.com)
 *
 * Las subscriptions las guardamos en PushSubscription (Prisma model).
 */

import { db } from "./db"

let configured = false
let webPushModule: any = null

async function getWebPush(): Promise<any> {
  if (webPushModule) return webPushModule
  // @ts-ignore — la lib no tiene types nativos, lo tratamos como any
  const mod: any = await import("web-push")
  webPushModule = mod?.default ?? mod

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? "mailto:cobraorvex@gmail.com"

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys no configuradas. Generalas con `npx web-push generate-vapid-keys`")
  }

  if (!configured) {
    webPushModule.setVapidDetails(subject, publicKey, privateKey)
    configured = true
  }
  return webPushModule
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
  tag?: string
}

/** Envía a un user. Si hay subscriptions vencidas (410 Gone) las elimina. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const subs = await db.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return { sent: 0, failed: 0 }

  const wp = await getWebPush()
  let sent = 0
  let failed = 0
  const expired: string[] = []

  for (const s of subs) {
    try {
      await wp.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      )
      sent++
      await db.pushSubscription
        .update({ where: { id: s.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {})
    } catch (err: any) {
      failed++
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expired.push(s.id)
      }
    }
  }

  if (expired.length > 0) {
    await db.pushSubscription.deleteMany({ where: { id: { in: expired } } }).catch(() => {})
  }

  return { sent, failed }
}

/** Envía a TODOS los users de un tenant (todos los empleados / dueño). */
export async function sendPushToTenant(tenantId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const users = await db.user.findMany({
    where: { tenantId, active: true },
    select: { id: true },
  })
  let totalSent = 0
  let totalFailed = 0
  for (const u of users) {
    const r = await sendPushToUser(u.id, payload)
    totalSent += r.sent
    totalFailed += r.failed
  }
  return { sent: totalSent, failed: totalFailed }
}
