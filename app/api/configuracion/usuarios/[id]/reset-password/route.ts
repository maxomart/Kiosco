import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { generatePassword } from "@/lib/utils"

/**
 * POST /api/configuracion/usuarios/[id]/reset-password
 *
 * Resetea la contraseña de un usuario del tenant. Sólo OWNER/ADMIN. Devuelve
 * la nueva contraseña en texto plano UNA SOLA VEZ — el OWNER la copia y se
 * la pasa al empleado, que después puede cambiarla con "Cambiar mi contraseña".
 *
 * Restricciones:
 *   - Un ADMIN no puede resetear a un OWNER (jerarquía).
 *   - Nadie puede resetearse a sí mismo (acá; para eso está /configuracion/password).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sólo el dueño o admin puede resetear contraseñas" }, { status: 403 })
  }

  const { id } = await params
  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, tenantId: true, role: true },
  })
  if (!target || target.tenantId !== tenantId) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }
  if (id === session.user.id) {
    return NextResponse.json({
      error: "Para tu propia contraseña usá 'Cambiar mi contraseña'.",
    }, { status: 400 })
  }
  if (target.role === "OWNER" && session.user.role !== "OWNER") {
    return NextResponse.json({
      error: "Un admin no puede resetear la contraseña de un dueño.",
    }, { status: 403 })
  }

  const newPassword = generatePassword(12)
  const hashed = await bcrypt.hash(newPassword, 10)
  await db.user.update({
    where: { id },
    data: { password: hashed },
  })

  return NextResponse.json({ password: newPassword })
}
