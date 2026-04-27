import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { confirmEmailCode } from "@/lib/email-verification"

// POST /api/auth/email-verify/confirm
// Body: { code: string, userId?: string }
//
// Same dual-auth as /start: prefer the session, fall back to userId from
// the post-signup state. On success the user row's emailVerified flips to
// now() and we return ok=true so the client can redirect to /login (or
// /inicio if they're already logged in).

export async function POST(req: Request) {
  let userId: string | null = null
  const session = await auth().catch(() => null)
  if (session?.user?.id) userId = session.user.id

  let body: { code?: string; userId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  if (!userId && body.userId && typeof body.userId === "string") userId = body.userId
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const code = body.code?.toString().trim()
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Ingresá el código de 6 dígitos." }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, emailVerified: true },
  })
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true })
  }

  const result = await confirmEmailCode({ userId, code })
  switch (result.status) {
    case "ok":
      return NextResponse.json({ ok: true })
    case "no-active-code":
      return NextResponse.json(
        { error: "No tenés un código activo. Pedí uno nuevo.", reason: "no-code" },
        { status: 400 }
      )
    case "expired":
      return NextResponse.json(
        { error: "El código venció. Pedí uno nuevo.", reason: "expired" },
        { status: 400 }
      )
    case "max-attempts":
      return NextResponse.json(
        { error: "Demasiados intentos. Pedí un código nuevo.", reason: "max-attempts" },
        { status: 400 }
      )
    case "wrong":
      return NextResponse.json({ error: "Código incorrecto.", reason: "wrong" }, { status: 400 })
  }
}
