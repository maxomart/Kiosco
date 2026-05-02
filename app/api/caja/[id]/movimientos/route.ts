import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export const dynamic = "force-dynamic"

const createSchema = z.object({
  type: z.enum(["WITHDRAWAL", "DEPOSIT"]),
  amount: z.number().positive("El monto tiene que ser mayor a 0"),
  reason: z.string().trim().min(2, "Decí brevemente para qué").max(200),
  notes: z.string().trim().max(500).optional(),
})

async function findSession(id: string, tenantId: string, isSuperAdmin: boolean) {
  const sess = await db.cashSession.findUnique({ where: { id } })
  if (!sess) return null
  if (!isSuperAdmin && sess.tenantId !== tenantId) return null
  return sess
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session, isSuperAdmin } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  const sess = await findSession(id, tenantId!, !!isSuperAdmin)
  if (!sess) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })

  const movements = await db.cashMovement.findMany({
    where: { cashSessionId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ movements })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session, isSuperAdmin } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  const sess = await findSession(id, tenantId!, !!isSuperAdmin)
  if (!sess) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })
  if (sess.status !== "OPEN") {
    return NextResponse.json({ error: "La caja está cerrada" }, { status: 400 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 422 })
  }

  const movement = await db.cashMovement.create({
    data: {
      type: parsed.data.type,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      notes: parsed.data.notes,
      tenantId: sess.tenantId,
      cashSessionId: id,
      userId: session.user.id!,
    },
    include: { user: { select: { name: true } } },
  })
  return NextResponse.json({ movement })
}
