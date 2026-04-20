import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

const patchSchema = z.object({
  active: z.boolean().optional(),
  plan: z.enum(["FREE", "STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"]).optional(),
  name: z.string().min(1).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const tenant = await db.tenant.findUnique({ where: { id: params.id } })
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })

  try {
    await db.$transaction(async (tx) => {
      if (parsed.data.active !== undefined || parsed.data.name) {
        await tx.tenant.update({
          where: { id: params.id },
          data: {
            ...(parsed.data.active !== undefined && { active: parsed.data.active }),
            ...(parsed.data.name && { name: parsed.data.name }),
          },
        })
        if (parsed.data.active === false) {
          await tx.user.updateMany({ where: { tenantId: params.id }, data: { active: false } })
        }
      }
      if (parsed.data.plan) {
        await tx.subscription.upsert({
          where: { tenantId: params.id },
          create: { tenantId: params.id, plan: parsed.data.plan, status: "ACTIVE" },
          update: { plan: parsed.data.plan },
        })
      }
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  await db.tenant.update({ where: { id: params.id }, data: { active: false } })
  await db.user.updateMany({ where: { tenantId: params.id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
