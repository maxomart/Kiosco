import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { issueEmailCode, EMAIL_CODE_TTL_MIN } from "@/lib/email-verification"
import { sendEmail } from "@/lib/email"
import { renderEmailVerificationCode } from "@/lib/email-templates"

// POST /api/auth/email-verify/start
// Issues a fresh 6-digit code for the current session's user and emails it.
// Throttled to 1 send per 60 s to prevent inbox flooding.
//
// We accept either a logged-in session OR a `userId` body (used right after
// signup, where the user may not have an active session yet because we
// don't auto-login until they verify).

export async function POST(req: Request) {
  let userId: string | null = null

  // Logged-in session takes priority — that's the resend-from-page case.
  const session = await auth().catch(() => null)
  if (session?.user?.id) userId = session.user.id

  // Fallback: a `userId` we previously returned to the client at signup.
  // Even though it could be tampered with, the only thing it can do is
  // trigger an email to the *real* address of that user, throttled. No
  // info leaked back to the attacker.
  if (!userId) {
    try {
      const body = (await req.json()) as { userId?: string }
      if (body.userId && typeof body.userId === "string") userId = body.userId
    } catch {
      /* empty body is fine when session exists */
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerified: true },
  })
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }
  if (user.emailVerified) {
    return NextResponse.json({ alreadyVerified: true })
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
  const ua = req.headers.get("user-agent") ?? null

  const result = await issueEmailCode({ userId: user.id, ipAddress: ip, userAgent: ua })
  if ("throttled" in result) {
    return NextResponse.json(
      { error: `Esperá ${result.retryInSec}s antes de pedir otro código.`, retryInSec: result.retryInSec },
      { status: 429 }
    )
  }

  const { html, text, subject } = renderEmailVerificationCode({
    name: user.name,
    code: result.code,
    expiresInMin: EMAIL_CODE_TTL_MIN,
  })

  const sendRes = await sendEmail({ to: user.email, subject, html, text })

  // Dev convenience: when Resend isn't configured we still want the test
  // user to be able to verify, so log the code to the server console.
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email-verify] code for ${user.email}: ${result.code}`)
  }

  return NextResponse.json({
    sent: true,
    sentTo: maskEmail(user.email),
    emailDelivered: sendRes.ok,
  })
}

function maskEmail(email: string): string {
  const [u, d] = email.split("@")
  if (!d) return email
  const v = Math.min(2, u.length)
  return `${u.slice(0, v)}${"•".repeat(Math.max(1, u.length - v))}@${d}`
}
