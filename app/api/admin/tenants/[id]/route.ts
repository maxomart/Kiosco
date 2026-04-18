import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

// PATCH: activar/desactivar tenant
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await req.json()
  const tenant = await db.tenant.update({
    where: { id: params.id },
    data: { active: body.active },
  })

  // Si se desactiva, también desactivar sus usuarios. Si se activa, reactivarlos.
  if (body.active === false) {
    await db.user.updateMany({
      where: { tenantId: params.id },
      data: { active: false },
    })
  } else {
    await db.user.updateMany({
      where: { tenantId: params.id },
      data: { active: true },
    })
  }

  return NextResponse.json({ tenant })
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
