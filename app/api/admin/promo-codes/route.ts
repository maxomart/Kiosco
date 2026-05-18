import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

const VALID_PLANS = ["STARTER", "PROFESSIONAL", "BUSINESS"]

function computeStatus(p: {
  active: boolean
  expiresAt: Date | null
  maxUses: number
  usedCount: number
}): string {
  if (!p.active) return "DISABLED"
  if (p.expiresAt && p.expiresAt < new Date()) return "EXPIRED"
  if (p.maxUses - p.usedCount <= 0) return "EXHAUSTED"
  return "ACTIVE"
}

// GET /api/admin/promo-codes — lista todos los códigos de promoción
export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const codes = await db.promoCode.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json({
    codes: codes.map((p) => ({
      id: p.id,
      code: p.code,
      description: p.description,
      planGranted: p.planGranted,
      daysGranted: p.daysGranted,
      maxUses: p.maxUses,
      usedCount: p.usedCount,
      remaining: Math.max(0, p.maxUses - p.usedCount),
      active: p.active,
      expiresAt: p.expiresAt,
      status: computeStatus(p),
      createdAt: p.createdAt,
    })),
  })
}

// POST /api/admin/promo-codes — crea un código nuevo
export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const code = String(body.code ?? "").trim().toLowerCase()
  const planGranted = String(body.planGranted ?? "")
  const daysGranted = Number(body.daysGranted)
  const maxUses = Number(body.maxUses)
  const description = body.description
    ? String(body.description).trim().slice(0, 200)
    : null
  const expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null

  if (code.length < 3 || code.length > 64 || !/^[a-z0-9_-]+$/.test(code)) {
    return NextResponse.json(
      { error: "El código debe tener 3-64 caracteres: letras, números, - o _ (sin espacios)" },
      { status: 400 }
    )
  }
  if (!VALID_PLANS.includes(planGranted)) {
    return NextResponse.json(
      { error: `Plan inválido. Válidos: ${VALID_PLANS.join(", ")}` },
      { status: 400 }
    )
  }
  if (!Number.isInteger(daysGranted) || daysGranted <= 0) {
    return NextResponse.json(
      { error: "Los días deben ser un número entero positivo" },
      { status: 400 }
    )
  }
  if (!Number.isInteger(maxUses) || maxUses <= 0) {
    return NextResponse.json(
      { error: "El cupo debe ser un número entero positivo" },
      { status: 400 }
    )
  }
  if (expiresAt && isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 })
  }

  const existing = await db.promoCode.findUnique({ where: { code } })
  if (existing) {
    return NextResponse.json(
      { error: `Ya existe un código "${code}"` },
      { status: 409 }
    )
  }

  const created = await db.promoCode.create({
    data: { code, planGranted, daysGranted, maxUses, description, expiresAt },
  })
  return NextResponse.json({ ok: true, id: created.id })
}
