import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { hashCode, setDeviceCookie, ADMIN_DEVICE_MAX_ATTEMPTS } from "@/lib/admin-device"

// POST /api/admin/device/verify
// Body: { challengeId: string, code: string }
//
// Validates the code against the active challenge. Marks fingerprint as
// trusted, sets cookie, returns { ok: true }. Each challenge gets up to
// ADMIN_DEVICE_MAX_ATTEMPTS bad guesses before being burned.

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  let body: { challengeId?: string; code?: string; label?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }
  const challengeId = body.challengeId?.toString().trim()
  const code = body.code?.toString().trim()
  const label = body.label?.toString().slice(0, 60).trim() || null

  if (!challengeId || !code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 })
  }

  const challenge = await db.adminDeviceChallenge.findUnique({ where: { id: challengeId } })
  if (!challenge || challenge.userId !== session.user.id) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 })
  }
  if (challenge.consumedAt) {
    return NextResponse.json({ error: "Ese código ya fue usado" }, { status: 400 })
  }
  if (challenge.expiresAt < new Date()) {
    return NextResponse.json({ error: "El código expiró. Pedí uno nuevo." }, { status: 400 })
  }
  if (challenge.attempts >= ADMIN_DEVICE_MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Demasiados intentos. Pedí un código nuevo." }, { status: 400 })
  }

  const matches = challenge.codeHash === hashCode(code)
  if (!matches) {
    await db.adminDeviceChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    })
    return NextResponse.json({ error: "Código incorrecto" }, { status: 400 })
  }

  // Code OK — consume challenge and mark fingerprint trusted.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
  const ua = req.headers.get("user-agent") ?? null

  // upsert handles the (rare) case where the same user verifies a
  // previously-revoked fingerprint and we want to "un-revoke" it.
  const device = await db.adminTrustedDevice.upsert({
    where: { userId_fingerprint: { userId: session.user.id, fingerprint: challenge.fingerprint } },
    update: { revokedAt: null, lastUsedAt: new Date(), ipAddress: ip, userAgent: ua, label: label ?? undefined },
    create: {
      userId: session.user.id,
      fingerprint: challenge.fingerprint,
      label,
      ipAddress: ip,
      userAgent: ua,
    },
  })

  await db.adminDeviceChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  })

  await setDeviceCookie(device.id)
  return NextResponse.json({ ok: true, deviceId: device.id })
}
