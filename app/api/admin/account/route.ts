import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/admin/account — return the current admin's name + email so
// the security page can pre-fill the form. Cheaper than wiring up
// SessionProvider just for this one screen.
export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true },
  })
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  return NextResponse.json({ user })
}

const patchSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().max(200).optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(10, "La contraseña nueva debe tener al menos 10 caracteres").max(128).optional(),
  })
  .refine(
    // To change email or password the admin has to retype the current
    // password — protects against a stolen-session takeover.
    (d) =>
      (!d.email && !d.newPassword) || !!d.currentPassword,
    { message: "Para cambiar email o contraseña, ingresá tu contraseña actual." },
  )

// PATCH /api/admin/account
// Lets the super-admin update their own email, name, or password from
// /admin/seguridad. Email + password changes require typing the current
// password.
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    )
  }
  const data = parsed.data

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, password: true },
  })
  if (!me) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  // Verify current password if email/pwd changing
  const sensitive = !!data.email || !!data.newPassword
  if (sensitive) {
    if (!data.currentPassword) {
      return NextResponse.json(
        { error: "Ingresá tu contraseña actual para confirmar." },
        { status: 400 },
      )
    }
    if (!me.password) {
      return NextResponse.json(
        { error: "Tu cuenta no tiene contraseña local. Contactá soporte." },
        { status: 400 },
      )
    }
    const ok = await bcrypt.compare(data.currentPassword, me.password)
    if (!ok) {
      return NextResponse.json(
        { error: "La contraseña actual no coincide." },
        { status: 400 },
      )
    }
  }

  // If changing email, make sure it's not taken by someone else.
  if (data.email && data.email.toLowerCase() !== me.email.toLowerCase()) {
    const taken = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: { id: true },
    })
    if (taken) {
      return NextResponse.json(
        { error: "Ese email ya está en uso por otra cuenta." },
        { status: 409 },
      )
    }
  }

  const update: Record<string, any> = {}
  if (data.name) update.name = data.name
  if (data.email) update.email = data.email.toLowerCase()
  if (data.newPassword) update.password = await bcrypt.hash(data.newPassword, 12)

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, noop: true })
  }

  await db.user.update({ where: { id: session.user.id }, data: update })

  // If we changed email or password, every logged-in session of this
  // admin should ideally re-authenticate. We can't invalidate JWTs
  // without a session table, but we return a flag so the client can
  // force a logout-redirect on the changing tab.
  return NextResponse.json({
    ok: true,
    requiresReauth: !!data.email || !!data.newPassword,
  })
}
