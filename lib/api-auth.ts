/**
 * Bearer-token validator for the public /api/v1 surface.
 *
 * Token format: `rk_live_<64 hex chars>`
 *   - prefix `rk_live_` is constant (could split rk_test_ later for sandbox keys)
 *   - 32 random bytes -> 64 hex chars (256 bits of entropy)
 *
 * Storage:
 *   - We NEVER store the raw token. We store sha256(rawToken) as `hashedKey`.
 *   - We also store the first 12 chars of the raw key (`rk_live_xxxx…`) as
 *     `prefix` so the UI can show a non-secret hint per row.
 *
 * Verification path:
 *   1. Read `Authorization: Bearer rk_live_…` (or `x-api-key` header).
 *   2. sha256 the candidate, look up by `hashedKey`.
 *   3. Reject if revoked or expired.
 *   4. Update `lastUsedAt` (best-effort, fire-and-forget).
 *
 * No DB cache here — Postgres lookup on `hashedKey` (unique index) is O(1).
 */

import { createHash, randomBytes } from "crypto"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

export interface GeneratedKey {
  raw: string       // shown ONCE to the user
  prefix: string    // safe to display
  hashed: string    // what we persist
}

export function generateApiKey(): GeneratedKey {
  const random = randomBytes(32).toString("hex")
  const raw = `rk_live_${random}`
  const prefix = raw.slice(0, 12)
  const hashed = createHash("sha256").update(raw).digest("hex")
  return { raw, prefix, hashed }
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

export interface VerifiedApiKey {
  tenantId: string
  keyId: string
  scopes: string[]   // parsed from comma-separated "scopes" column
}

/** Extracts the raw bearer token from a request. Returns null if missing/malformed. */
function extractRawToken(req: Request | NextRequest): string | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization")
  if (authHeader) {
    const match = /^Bearer\s+(\S+)$/i.exec(authHeader.trim())
    if (match) return match[1]
  }
  // Optional fallback: x-api-key
  const xKey = req.headers.get("x-api-key")
  if (xKey && xKey.startsWith("rk_")) return xKey.trim()
  return null
}

/**
 * Verifies a request's bearer token. Returns null if invalid, revoked, or expired.
 * Also bumps lastUsedAt asynchronously.
 */
export async function verifyApiKey(req: Request | NextRequest): Promise<VerifiedApiKey | null> {
  const raw = extractRawToken(req)
  if (!raw || !raw.startsWith("rk_")) return null

  const hashed = hashApiKey(raw)

  const row = await db.apiKey.findUnique({
    where: { hashedKey: hashed },
    select: { id: true, tenantId: true, scopes: true, revokedAt: true, expiresAt: true },
  })

  if (!row) return null
  if (row.revokedAt) return null
  if (row.expiresAt && row.expiresAt < new Date()) return null

  // Fire-and-forget: bump lastUsedAt. Do NOT await — keeps API hot path lean.
  void db.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {/* swallow — non-critical */})

  return {
    tenantId: row.tenantId,
    keyId: row.id,
    scopes: (row.scopes ?? "read").split(",").map((s) => s.trim()).filter(Boolean),
  }
}

/** True if a verified key's scopes include the requested one. "write" implies "read". */
export function hasScope(verified: VerifiedApiKey, scope: "read" | "write"): boolean {
  if (verified.scopes.includes(scope)) return true
  if (scope === "read" && verified.scopes.includes("write")) return true
  return false
}

/**
 * Standard rate-limit headers we attach to every /api/v1 response.
 * We don't track real usage yet — these are best-effort static placeholders so
 * client SDKs can already wire into them. Replace with a sliding window backed
 * by Redis when traffic justifies it.
 */
export function rateLimitHeaders(): Record<string, string> {
  return {
    "X-RateLimit-Limit": "1000",
    "X-RateLimit-Remaining": "999",
    "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 3600),
    "Cache-Control": "no-store",
  }
}
