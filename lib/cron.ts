/**
 * Shared-secret guard for `/api/cron/*` routes.
 *
 * SETUP:
 *   1. Generate a long random string (e.g. `openssl rand -hex 48`).
 *   2. Set it as the env var `CRON_SECRET` in Railway / Vercel.
 *   3. Configure your scheduler (Railway cron, Vercel Cron, GH Actions, etc.)
 *      to send `Authorization: Bearer ${CRON_SECRET}` (or `x-cron-secret: …`)
 *      with each scheduled hit.
 *
 * Returning `false` from `verifyCronSecret(req)` lets the route reply 401.
 * If `CRON_SECRET` is missing entirely, ALL cron requests are rejected
 * (fail-closed) — we never accept unauthenticated cron triggers in prod.
 */

import type { NextRequest } from "next/server"

export function verifyCronSecret(req: Request | NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.warn("[cron] CRON_SECRET no está configurado — rechazando request")
    return false
  }

  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization")
  if (auth) {
    const match = /^Bearer\s+(\S+)$/i.exec(auth.trim())
    if (match && timingSafeEqual(match[1], expected)) return true
  }

  const x = req.headers.get("x-cron-secret")
  if (x && timingSafeEqual(x.trim(), expected)) return true

  return false
}

/** Constant-time string compare to avoid timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}
