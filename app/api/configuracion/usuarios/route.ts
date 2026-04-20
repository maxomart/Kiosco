import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { generatePassword, PLAN_LIMITS, type Plan } from "@/lib/utils"

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  try {
    const users = await db.user.findMany({
      where: { tenantId: tenantId! },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    })
    return NextResponse.json({ users })
  } catch (err) {
    console.error("[GET /api/configuracion/usuarios]", err)
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 })
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "CASHIER"]),
})

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Solo el dueño o admin puede crear usuarios" }, { status: 403 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  // Check plan limit
  const [userCount, sub] = await Promise.all([
    db.user.count({ where: { tenantId: tenantId!, active: true } }),
    db.subscription.findUnique({ where: { tenantId: tenantId! }, select: { plan: true } }),
  ])
  const plan = (sub?.plan ?? "FREE") as Plan
  const limit = PLAN_LIMITS[plan].users
  if (userCount >= limit) {
    return NextResponse.json({ error: `Límite del plan ${plan}: máximo ${limit} usuarios. Actualizá para agregar más.` }, { status: 403 })
  }

  // Check email unique within tenant
  const exists = await db.user.findFirst({ where: { email: parsed.data.email, tenantId: tenantId! } })
  if (exists) return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 })

  const password = generatePassword(12)
  const hashed = await bcrypt.hash(password, 10)
  try {
    await db.user.create({
      data: {
        name: parsed.data.name.trim(),
        email: parsed.data.email.toLowerCase().trim(),
        password: hashed,
        role: parsed.data.role,
        tenantId: tenantId!,
        active: true,
      },
    })
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "Email ya registrado" }, { status: 409 })
    console.error("[POST /api/configuracion/usuarios]", err)
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 })
  }

  return NextResponse.json({ email: parsed.data.email, password }, { status: 201 })
}
