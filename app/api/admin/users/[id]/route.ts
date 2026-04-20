import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

const patchSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(["CASHIER", "ADMIN", "OWNER", "SUPER_ADMIN"]).optional(),
  name: z.string().min(1).optional(),
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await ctx.params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const user = await db.user.findUnique({ where: { id } })
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  await db.user.update({
    where: { id },
    data: {
      ...(parsed.data.active !== undefined && { active: parsed.data.active }),
      ...(parsed.data.role && { role: parsed.data.role }),
      ...(parsed.data.name && { name: parsed.data.name }),
    },
  })

  return NextResponse.json({ ok: true })
}
