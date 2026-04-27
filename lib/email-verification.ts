/**
 * Email verification helpers — used during signup so we know the email
 * the user typed actually belongs to them.
 *
 * Flow:
 *  1. User signs up → we create the User row with emailVerified = null,
 *     issue a 6-digit code, store sha256(code), email the plaintext.
 *  2. User goes to /verificar-email and types the code.
 *  3. /api/auth/email-verify/confirm checks sha256(typed) == stored
 *     and within 30 min. If OK, set emailVerified = now() and let them
 *     into the dashboard.
 *
 * The dashboard layout enforces emailVerified !== null. Existing users
 * (created before this feature shipped) are backfilled at deploy by
 * scripts/backfill-email-verified.js so they don't get locked out.
 */

import { createHash, randomInt } from "crypto"
import { db } from "@/lib/db"

export const EMAIL_CODE_TTL_MIN = 30
export const EMAIL_CODE_MAX_ATTEMPTS = 6
export const EMAIL_RESEND_THROTTLE_S = 60

export function hashEmailCode(code: string): string {
  return createHash("sha256").update(code).digest("hex")
}

export function generateEmailCode(): string {
  return String(randomInt(100000, 1000000))
}

/**
 * Issue a fresh code for a user. If the user already has an active
 * (non-expired, non-consumed) code newer than EMAIL_RESEND_THROTTLE_S
 * seconds, we refuse to issue another one — that's the rate-limit so
 * a bot can't flood the user's inbox.
 *
 * Returns the *plaintext* code so the caller can email it. Stores only
 * the hash. Never log the plaintext outside of dev.
 */
export async function issueEmailCode(opts: {
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
  force?: boolean // skip throttle (used after fresh signup, where there's no prior code anyway)
}): Promise<{ code: string } | { throttled: true; retryInSec: number }> {
  if (!opts.force) {
    const recent = await db.emailVerificationCode.findFirst({
      where: {
        userId: opts.userId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })
    if (recent) {
      const ageS = Math.floor((Date.now() - recent.createdAt.getTime()) / 1000)
      if (ageS < EMAIL_RESEND_THROTTLE_S) {
        return { throttled: true, retryInSec: EMAIL_RESEND_THROTTLE_S - ageS }
      }
    }
  }

  const code = generateEmailCode()
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MIN * 60 * 1000)
  await db.emailVerificationCode.create({
    data: {
      userId: opts.userId,
      codeHash: hashEmailCode(code),
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
      expiresAt,
    },
  })
  return { code }
}

/**
 * Consume a code. Returns "ok" on success (and marks the user verified),
 * or a specific failure reason so the UI can display it.
 */
export async function confirmEmailCode(opts: {
  userId: string
  code: string
}): Promise<
  | { status: "ok" }
  | { status: "no-active-code" }
  | { status: "expired" }
  | { status: "max-attempts" }
  | { status: "wrong" }
> {
  const challenge = await db.emailVerificationCode.findFirst({
    where: { userId: opts.userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  })
  if (!challenge) return { status: "no-active-code" }
  if (challenge.expiresAt < new Date()) return { status: "expired" }
  if (challenge.attempts >= EMAIL_CODE_MAX_ATTEMPTS) return { status: "max-attempts" }

  const matches = challenge.codeHash === hashEmailCode(opts.code)
  if (!matches) {
    await db.emailVerificationCode.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    })
    return { status: "wrong" }
  }

  await db.$transaction([
    db.emailVerificationCode.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    }),
    db.user.update({
      where: { id: opts.userId },
      data: { emailVerified: new Date() },
    }),
  ])
  return { status: "ok" }
}
