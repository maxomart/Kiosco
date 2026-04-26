import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isOpenAIConfigured } from "@/lib/openai"

/**
 * GET /api/admin/health
 *
 * One-stop check for everything the SaaS depends on. Each subsystem is
 * checked with a tiny test (DB ping, OpenAI key presence + cheap probe,
 * Resend key presence, MP/Stripe env). Returns a list of {service,
 * status, detail} so the UI can show a green/yellow/red row per row.
 *
 * "ok" / "warn" / "down" — keep these strings stable; UI matches on them.
 */

type ServiceStatus = "ok" | "warn" | "down"
type ServiceCheck = {
  id: string
  label: string
  status: ServiceStatus
  detail: string
  latencyMs?: number
}

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const checks: ServiceCheck[] = []

  // 1. Database — single SELECT 1 to measure latency
  {
    const t0 = Date.now()
    try {
      await db.$queryRaw`SELECT 1`
      const lat = Date.now() - t0
      checks.push({
        id: "db",
        label: "Base de datos (Postgres)",
        status: lat < 200 ? "ok" : lat < 800 ? "warn" : "down",
        detail: lat < 200 ? "Latencia normal" : lat < 800 ? "Latencia alta" : "Lenta — revisá Railway",
        latencyMs: lat,
      })
    } catch (e: any) {
      checks.push({
        id: "db",
        label: "Base de datos (Postgres)",
        status: "down",
        detail: e?.message?.slice(0, 80) ?? "No se pudo conectar",
        latencyMs: Date.now() - t0,
      })
    }
  }

  // 2. OpenAI — key present + a tiny models.list probe (cheap, no usage)
  if (!isOpenAIConfigured()) {
    checks.push({
      id: "openai",
      label: "OpenAI (Asistente IA)",
      status: "warn",
      detail: "OPENAI_API_KEY no configurada — la IA funciona en modo fallback",
    })
  } else {
    const t0 = Date.now()
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        signal: AbortSignal.timeout(4000),
      })
      const lat = Date.now() - t0
      if (res.ok) {
        checks.push({
          id: "openai",
          label: "OpenAI (Asistente IA)",
          status: "ok",
          detail: `Conectado · ${lat}ms`,
          latencyMs: lat,
        })
      } else if (res.status === 401) {
        checks.push({
          id: "openai",
          label: "OpenAI (Asistente IA)",
          status: "down",
          detail: "401 — la API key está inválida o vencida",
          latencyMs: lat,
        })
      } else {
        checks.push({
          id: "openai",
          label: "OpenAI (Asistente IA)",
          status: "warn",
          detail: `HTTP ${res.status}`,
          latencyMs: lat,
        })
      }
    } catch (e: any) {
      checks.push({
        id: "openai",
        label: "OpenAI (Asistente IA)",
        status: "down",
        detail: e?.message?.slice(0, 80) ?? "Timeout",
      })
    }
  }

  // 3. Resend (email) — key presence only. No probe to avoid burning quota.
  checks.push({
    id: "resend",
    label: "Resend (emails)",
    status: process.env.RESEND_API_KEY ? "ok" : "warn",
    detail: process.env.RESEND_API_KEY
      ? `Configurado · from: ${process.env.EMAIL_FROM ?? "default"}`
      : "RESEND_API_KEY no configurada — los emails se loguean pero no se envían",
  })

  // 4. Mercado Pago — token presence
  checks.push({
    id: "mp",
    label: "Mercado Pago (billing)",
    status: process.env.MP_PLATFORM_ACCESS_TOKEN ? "ok" : "warn",
    detail: process.env.MP_PLATFORM_ACCESS_TOKEN
      ? "Access token configurado"
      : "MP_PLATFORM_ACCESS_TOKEN no configurado — no podés cobrarle a tenants en pesos",
  })

  // 5. Stripe — secret key presence
  const hasStripe = !!process.env.STRIPE_SECRET_KEY
  checks.push({
    id: "stripe",
    label: "Stripe (billing internacional)",
    status: hasStripe ? "ok" : "warn",
    detail: hasStripe ? "Configurado" : "Sin Stripe — solo cobramos en ARS",
  })

  // 6. Auth secret
  checks.push({
    id: "auth",
    label: "NextAuth secret",
    status: process.env.NEXTAUTH_SECRET ? "ok" : "down",
    detail: process.env.NEXTAUTH_SECRET
      ? "OK"
      : "NEXTAUTH_SECRET vacío — NextAuth NO va a funcionar en producción",
  })

  // Aggregate
  const summary = {
    overall: checks.some((c) => c.status === "down")
      ? ("down" as ServiceStatus)
      : checks.some((c) => c.status === "warn")
        ? ("warn" as ServiceStatus)
        : ("ok" as ServiceStatus),
    okCount: checks.filter((c) => c.status === "ok").length,
    warnCount: checks.filter((c) => c.status === "warn").length,
    downCount: checks.filter((c) => c.status === "down").length,
  }

  // 7. Counts that surface signal but aren't a "service":
  const [tenants, users, sales, recentErrors] = await Promise.all([
    db.tenant.count(),
    db.user.count(),
    db.sale.count(),
    db.auditLog
      .findMany({
        where: {
          action: { contains: "error", mode: "insensitive" },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        take: 5,
      })
      .catch(() => [] as any[]),
  ])

  return NextResponse.json({
    summary,
    checks,
    counts: { tenants, users, sales },
    recentErrors: (recentErrors as any[]).map((e) => ({
      action: e.action,
      entity: e.entity,
      createdAt: e.createdAt,
    })),
  })
}
