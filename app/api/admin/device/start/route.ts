import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  hashFingerprint,
  hashCode,
  generateCode,
  setDeviceCookie,
  ADMIN_DEVICE_CHALLENGE_TTL_MIN,
} from "@/lib/admin-device"
import { sendEmail } from "@/lib/email"

// POST /api/admin/device/start
// Body: { signal: string }  // raw fingerprint string from the client
//
// Three branches:
//  1. fingerprint already trusted → set cookie, return { trusted: true }
//  2. user has zero trusted devices yet → auto-trust this device (bootstrap)
//  3. otherwise → email a 6-digit code, return { trusted: false, challengeId }

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  let body: { signal?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }
  const signal = body.signal?.toString().trim()
  if (!signal || signal.length < 8) {
    return NextResponse.json({ error: "Falta firma de dispositivo" }, { status: 400 })
  }

  const fp = hashFingerprint(signal)
  const userId = session.user.id
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null
  const ua = req.headers.get("user-agent") ?? null

  // Branch 1: existing trusted device
  const existing = await db.adminTrustedDevice.findUnique({
    where: { userId_fingerprint: { userId, fingerprint: fp } },
  })
  if (existing && !existing.revokedAt) {
    await db.adminTrustedDevice.update({
      where: { id: existing.id },
      data: { lastUsedAt: new Date(), ipAddress: ip ?? existing.ipAddress, userAgent: ua ?? existing.userAgent },
    })
    await setDeviceCookie(existing.id)
    return NextResponse.json({ trusted: true, deviceId: existing.id })
  }

  // Branch 2: bootstrap — first trusted device for this admin
  const totalTrusted = await db.adminTrustedDevice.count({
    where: { userId, revokedAt: null },
  })
  if (totalTrusted === 0) {
    const created = await db.adminTrustedDevice.create({
      data: {
        userId,
        fingerprint: fp,
        label: "Mi compu (primera)",
        ipAddress: ip,
        userAgent: ua,
      },
    })
    await setDeviceCookie(created.id)
    return NextResponse.json({ trusted: true, deviceId: created.id, bootstrap: true })
  }

  // Branch 3: new device — issue a challenge and email the code
  const code = generateCode()
  const expiresAt = new Date(Date.now() + ADMIN_DEVICE_CHALLENGE_TTL_MIN * 60 * 1000)
  const challenge = await db.adminDeviceChallenge.create({
    data: {
      userId,
      fingerprint: fp,
      codeHash: hashCode(code),
      ipAddress: ip,
      userAgent: ua,
      expiresAt,
    },
  })

  // Best-effort email — if Resend isn't configured, we still create the
  // challenge so the admin can read the code from server logs in dev.
  const subject = `Código de verificación — Orvex Admin`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 8px 0; font-size: 18px;">Acceso a Orvex Admin</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Alguien intentó acceder al panel de administración desde un dispositivo nuevo.
        Si fuiste vos, usá este código:
      </p>
      <p style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827; background: #f3f4f6; padding: 16px; text-align: center; border-radius: 12px; margin: 16px 0;">
        ${code}
      </p>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
        Vence en ${ADMIN_DEVICE_CHALLENGE_TTL_MIN} minutos.<br />
        IP: <code>${ip ?? "desconocida"}</code><br />
        Navegador: <code>${(ua ?? "desconocido").slice(0, 80)}</code>
      </p>
      <p style="color: #ef4444; font-size: 13px; line-height: 1.5; margin-top: 24px;">
        <strong>Si no fuiste vos</strong>, ignorá este email y cambiá tu contraseña en /configuracion.
      </p>
    </div>
  `.trim()
  const text = `Código de verificación Orvex Admin: ${code}\n\nVence en ${ADMIN_DEVICE_CHALLENGE_TTL_MIN} minutos.\nIP: ${ip ?? "desconocida"}\n\nSi no fuiste vos, ignorá este email y cambiá tu contraseña.`

  await sendEmail({ to: session.user.email, subject, html, text })

  // Helpful in dev where Resend isn't configured:
  if (!process.env.RESEND_API_KEY) {
    console.log(`[admin-device] verification code for ${session.user.email}: ${code}`)
  }

  return NextResponse.json({
    trusted: false,
    challengeId: challenge.id,
    sentTo: maskEmail(session.user.email),
  })
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@")
  if (!domain) return email
  const visible = Math.min(2, user.length)
  return `${user.slice(0, visible)}${"•".repeat(Math.max(1, user.length - visible))}@${domain}`
}
