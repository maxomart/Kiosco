import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { z } from "zod"

const patchSchema = z.object({
  active: z.boolean(),
})

// PATCH: activar/desactivar tenant
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido (active:boolean requerido)" }, { status: 400 })
  }

  const existing = await db.tenant.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: "Kiosco no encontrado" }, { status: 404 })

  try {
    const tenant = await db.$transaction(async (tx) => {
      const t = await tx.tenant.update({
        where: { id: params.id },
        data: { active: parsed.data.active },
      })
      await tx.user.updateMany({
        where: { tenantId: params.id },
        data: { active: parsed.data.active },
      })
      return t
    })
    return NextResponse.json({ tenant })
  } catch (err) {
    console.error("[PATCH /api/admin/tenants/[id]]", err)
    return NextResponse.json({ error: "Error al actualizar kiosco" }, { status: 500 })
  }
}

// GET: estadísticas de un tenant específico
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const tenant = await db.tenant.findUnique({
    where: { id: params.id },
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      },
      _count: { select: { products: true, sales: true, clients: true } },
    },
  })

  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json({ tenant })
}
