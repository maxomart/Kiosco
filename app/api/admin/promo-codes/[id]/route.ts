import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// PATCH /api/admin/promo-codes/[id]
// Body: { active?, description?, maxUses?, expiresAt?, resetUsed? }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { id } = await params

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.active === "boolean") data.active = body.active
  if (typeof body.description === "string") {
    data.description = body.description.trim().slice(0, 200) || null
  }
  if (body.maxUses !== undefined) {
    const m = Number(body.maxUses)
    if (!Number.isInteger(m) || m <= 0) {
      return NextResponse.json({ error: "Cupo inválido" }, { status: 400 })
    }
    data.maxUses = m
  }
  if (body.resetUsed === true) data.usedCount = 0
  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null || body.expiresAt === "") {
      data.expiresAt = null
    } else {
      const d = new Date(String(body.expiresAt))
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "Fecha inválida" }, { status: 400 })
      }
      data.expiresAt = d
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 })
  }

  try {
    await db.promoCode.update({ where: { id }, data })
  } catch {
    return NextResponse.json({ error: "No se encontró el código" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/promo-codes/[id]
// Solo se permite si el código nunca se usó — si tiene usos, hay que
// desactivarlo para no perder el historial de canjes.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { id } = await params

  const promo = await db.promoCode.findUnique({
    where: { id },
    select: { usedCount: true },
  })
  if (!promo) {
    return NextResponse.json({ error: "No existe ese código" }, { status: 404 })
  }
  if (promo.usedCount > 0) {
    return NextResponse.json(
      {
        error:
          "Este código ya tiene usos. Desactivalo en vez de borrarlo (si lo borrás perdés el historial de quién lo usó).",
      },
      { status: 409 }
    )
  }
  await db.promoCode.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
