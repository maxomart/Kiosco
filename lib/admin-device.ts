/**
 * Device-binding for the super-admin panel.
 *
 * Threat model: the super-admin account has god-mode over every tenant
 * in the SaaS. Even if its password leaks (phishing, reused credentials),
 * we want a second factor that's tied to the physical machine the real
 * admin uses. NextAuth alone protects against impersonation by anyone
 * without the password — but not against phishing.
 *
 * Approach:
 *  1. After password login, we ask the browser for a fingerprint signal
 *     (UA + screen + timezone + a tiny canvas hash). The server hashes
 *     this with NEXTAUTH_SECRET and compares to AdminTrustedDevice.
 *  2. If it matches, we set a signed httpOnly cookie that lives 90 days
 *     and skip further checks until the cookie expires or is revoked.
 *  3. If it doesn't match, we email the admin a 6-digit code that's
 *     valid for 10 minutes. The admin types it in; we mark the device
 *     trusted and set the cookie.
 *  4. Bootstrap: if zero trusted devices exist for this user, the next
 *     login auto-trusts. Otherwise the admin would lock themselves out
 *     when this code first ships.
 *
 * Why not WebAuthn? Long-term we should — but it requires a passkey
 * registration flow and a fallback for password resets. This module
 * gets us 95% of the way without that complexity.
 */

import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"

const COOKIE_NAME = "orvex-admin-device"
const COOKIE_TTL_DAYS = 90
const CHALLENGE_TTL_MIN = 10
const CHALLENGE_MAX_ATTEMPTS = 5

/** Hashes the raw fingerprint signal so we never store it in plaintext. */
export function hashFingerprint(rawSignal: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "orvex-fallback-secret"
  return createHmac("sha256", secret).update(rawSignal).digest("hex")
}

/** sha256 of the verification code — we don't store plaintext codes. */
export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex")
}

/** Generate a cryptographically random 6-digit code. */
export function generateCode(): string {
  // randomInt(min, max) gives [min, max). 100000-999999 inclusive.
  return String(randomInt(100000, 1000000))
}

/** Sign a deviceId with NEXTAUTH_SECRET so the cookie can't be forged. */
function signDeviceId(deviceId: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "orvex-fallback-secret"
  return createHmac("sha256", secret).update(deviceId).digest("hex")
}

export function buildCookieValue(deviceId: string): string {
  return `${deviceId}.${signDeviceId(deviceId)}`
}

/** Returns the deviceId if the cookie value is valid, null otherwise. */
export function parseCookieValue(value: string | undefined): string | null {
  if (!value) return null
  const parts = value.split(".")
  if (parts.length !== 2) return null
  const [deviceId, sig] = parts
  if (!deviceId || !sig) return null
  const expected = signDeviceId(deviceId)
  // timingSafeEqual requires equal-length buffers
  if (sig.length !== expected.length) return null
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
      return null
    }
  } catch {
    return null
  }
  return deviceId
}

/** Set the trusted-device cookie. Call after a successful trust event. */
export async function setDeviceCookie(deviceId: string): Promise<void> {
  const c = await cookies()
  c.set({
    name: COOKIE_NAME,
    value: buildCookieValue(deviceId),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_TTL_DAYS * 24 * 60 * 60,
  })
}

/** Clear the cookie (used on revoke). */
export async function clearDeviceCookie(): Promise<void> {
  const c = await cookies()
  c.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

/** Read and validate the cookie. Returns deviceId or null. */
export async function readDeviceCookie(): Promise<string | null> {
  const c = await cookies()
  const raw = c.get(COOKIE_NAME)?.value
  return parseCookieValue(raw)
}

export const ADMIN_DEVICE_COOKIE = COOKIE_NAME
export const ADMIN_DEVICE_CHALLENGE_TTL_MIN = CHALLENGE_TTL_MIN
export const ADMIN_DEVICE_MAX_ATTEMPTS = CHALLENGE_MAX_ATTEMPTS
