/**
 * Rate limiting en memoria (proceso único).
 * Para múltiples instancias / serverless, migrar a Redis/Upstash.
 *
 * Política de login:
 *  - Máx 5 intentos fallidos por identificador en 15 minutos.
 *  - Al 5to fallo: bloqueo de 15 minutos.
 */

type Attempt = {
  count: number
  firstAttemptAt: number
  blockedUntil: number | null
}

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const BLOCK_MS = 15 * 60 * 1000

const loginStore = new Map<string, Attempt>()

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    Array.from(loginStore.entries()).forEach(([key, entry]) => {
      const expired = entry.blockedUntil
        ? entry.blockedUntil < now
        : now - entry.firstAttemptAt > WINDOW_MS
      if (expired) loginStore.delete(key)
    })
  }, 5 * 60 * 1000).unref?.()
}

export function checkLoginRateLimit(identifier: string): {
  allowed: boolean
  remainingAttempts: number
  retryAfterSec: number
} {
  const now = Date.now()
  const entry = loginStore.get(identifier)

  if (!entry) return { allowed: true, remainingAttempts: MAX_ATTEMPTS, retryAfterSec: 0 }

  if (entry.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSec: Math.ceil((entry.blockedUntil - now) / 1000),
    }
  }

  if (entry.blockedUntil && entry.blockedUntil <= now) {
    loginStore.delete(identifier)
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, retryAfterSec: 0 }
  }

  if (now - entry.firstAttemptAt > WINDOW_MS) {
    loginStore.delete(identifier)
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, retryAfterSec: 0 }
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - entry.count),
    retryAfterSec: 0,
  }
}

export function recordLoginFailure(identifier: string): void {
  const now = Date.now()
  const entry = loginStore.get(identifier)

  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    loginStore.set(identifier, { count: 1, firstAttemptAt: now, blockedUntil: null })
    return
  }

  entry.count += 1
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS
  }
  loginStore.set(identifier, entry)
}

export function resetLoginAttempts(identifier: string): void {
  loginStore.delete(identifier)
}

const apiStore = new Map<string, { count: number; windowStart: number }>()

/**
 * Rate limit genérico para endpoints API.
 * key = IP + ruta (armar afuera).
 */
export function checkApiRateLimit(
  key: string,
  opts: { max: number; windowSec: number }
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now()
  const windowMs = opts.windowSec * 1000
  const entry = apiStore.get(key)

  if (!entry || now - entry.windowStart > windowMs) {
    apiStore.set(key, { count: 1, windowStart: now })
    return { allowed: true, retryAfterSec: 0 }
  }

  if (entry.count >= opts.max) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((entry.windowStart + windowMs - now) / 1000),
    }
  }

  entry.count += 1
  return { allowed: true, retryAfterSec: 0 }
}
