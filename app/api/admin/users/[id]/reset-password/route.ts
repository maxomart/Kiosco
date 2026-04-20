import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { generatePassword } from "@/lib/utils"

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await ctx.params
  const user = await db.user.findUnique({ where: { id }, select: { id: true, email: true } })
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  const newPassword = generatePassword(12)
  const hashed = await bcrypt.hash(newPassword, 10)
  await db.user.update({ where: { id }, data: { password: hashed } })

  return NextResponse.json({ email: user.email, password: newPassword })
}
