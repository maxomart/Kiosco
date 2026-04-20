/**
 * Logger con sanitización de campos sensibles.
 * Usar en lugar de console.* cuando se pueda loguear un objeto con secretos.
 */

const SENSITIVE_KEYS = new Set([
  "password", "passwordHash", "hashedPassword",
  "token", "accessToken", "refreshToken", "idToken",
  "secret", "apiKey", "authorization", "cookie",
  "hashedKey",
  "DATABASE_URL", "NEXTAUTH_SECRET", "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  "MP_PLATFORM_ACCESS_TOKEN", "MP_WEBHOOK_SECRET",
  "TWILIO_AUTH_TOKEN", "CRON_SECRET",
])

const isProd = process.env.NODE_ENV === "production"

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[MaxDepth]"
  if (value == null) return value
  if (typeof value !== "object") return value
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(isProd ? {} : { stack: value.stack }),
    }
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k) || /password|token|secret/i.test(k)) {
      out[k] = "[REDACTED]"
    } else {
      out[k] = redact(v, depth + 1)
    }
  }
  return out
}

function format(scope: string, msg: string, meta?: unknown): string {
  if (meta === undefined) return `[${scope}] ${msg}`
  try {
    return `[${scope}] ${msg} ${JSON.stringify(redact(meta))}`
  } catch {
    return `[${scope}] ${msg} [unserializable]`
  }
}

export const logger = {
  info(scope: string, msg: string, meta?: unknown) {
    console.log(format(scope, msg, meta))
  },
  warn(scope: string, msg: string, meta?: unknown) {
    console.warn(format(scope, msg, meta))
  },
  error(scope: string, msg: string, err?: unknown) {
    console.error(format(scope, msg, err))
  },
}
