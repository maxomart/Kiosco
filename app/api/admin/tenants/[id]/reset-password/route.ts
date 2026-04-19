import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import bcrypt from "bcryptjs"

function generatePassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$"
  let pass = ""
  for (let i = 0; i < length; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)]
  }
  return pass
}

// POST /api/admin/tenants/[id]/reset-password
// Body: { userId: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await req.json()
  const { userId } = body

  if (!userId) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 })
  }

  // Verificar que el usuario pertenece al tenant
  const user = await db.user.findFirst({
    where: { id: userId, tenantId: params.id },
    select: { id: true, email: true, name: true },
  })

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado en este kiosco" }, { status: 404 })
  }

  const newPassword = generatePassword(16)
  const hashed = await bcrypt.hash(newPassword, 12)

  await db.user.update({
    where: { id: userId },
    data: { password: hashed },
  })

  return NextResponse.json({
    success: true,
    password: newPassword,
    email: user.email,
    name: user.name,
  })
}
