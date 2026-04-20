import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

export type AuditParams = {
  userId: string
  action: string
  entity: string
  entityId?: string | null
  oldValue?: unknown
  newValue?: unknown
  tenantId?: string | null
  req?: NextRequest | Request
}

function getClientIp(req?: NextRequest | Request): string | undefined {
  if (!req) return undefined
  const headers = "headers" in req ? req.headers : undefined
  if (!headers) return undefined
  const fwd = headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]!.trim()
  return headers.get("x-real-ip") ?? undefined
}

function safeStringify(value: unknown): string | null {
  if (value === undefined || value === null) return null
  try {
    const seen = new WeakSet()
    const out = JSON.stringify(value, (k, v) => {
      if (typeof v === "object" && v !== null) {
        if (seen.has(v as object)) return "[Circular]"
        seen.add(v as object)
      }
      if (k === "password" || k === "passwordHash" || k === "hashedPassword") return "[REDACTED]"
      if (k === "token" || k === "accessToken" || k === "refreshToken") return "[REDACTED]"
      if (k === "hashedKey" || k === "secret" || k === "apiKey") return "[REDACTED]"
      return v
    })
    return out ? out.slice(0, 5000) : null
  } catch {
    return null
  }
}

/**
 * Registra una acción en auditoría. NUNCA lanza error — solo loguea a console si falla.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  const ip = getClientIp(params.req)
  const userAgent =
    params.req && "headers" in params.req ? params.req.headers.get("user-agent") ?? undefined : undefined

  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        oldValue: safeStringify(params.oldValue),
        newValue: safeStringify(params.newValue),
        tenantId: params.tenantId ?? null,
        ip: ip ?? null,
        userAgent: userAgent ? userAgent.slice(0, 500) : null,
      },
    })
  } catch (err) {
    console.error("[audit] failed:", (err as Error).message)
  }
}
