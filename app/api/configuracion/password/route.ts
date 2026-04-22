import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

// POST /api/configuracion/password
// Lets a logged-in user change their own password. Requires the current
// password as a defence against hijacked sessions / shoulder-surfing.

const schema = z.object({
  currentPassword: z.string().min(1, "Ingresá tu contraseña actual."),
  newPassword: z
    .string()
    .min(10, "La nueva contraseña debe tener al menos 10 caracteres.")
    .max(128, "Contraseña demasiado larga."),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    )
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  })
  if (!user?.password) {
    return NextResponse.json({ error: "Usuario inválido" }, { status: 400 })
  }

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!ok) {
    return NextResponse.json(
      { error: "La contraseña actual no es correcta." },
      { status: 400 }
    )
  }

  // Reject trivial changes (same pw).
  const same = await bcrypt.compare(parsed.data.newPassword, user.password)
  if (same) {
    return NextResponse.json(
      { error: "La nueva contraseña tiene que ser distinta de la actual." },
      { status: 400 }
    )
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12)
  await db.user.update({
    where: { id: session.user.id },
    data: { password: hashed },
  })

  return NextResponse.json({ ok: true })
}
