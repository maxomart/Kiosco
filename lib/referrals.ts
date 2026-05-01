/**
 * Programa de referidos: cada user tiene un código único, otros se
 * registran con ese código, y ambos reciben 1 mes gratis (referralBonusMonths).
 */

import { db } from "./db"

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // sin chars confusos (0/O/1/I)

function makeCode(len = 8): string {
  let out = ""
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return out
}

/** Genera un código único para un user. Reintenta si choca. */
export async function generateReferralCodeForUser(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeCode(8)
    try {
      await db.user.update({ where: { id: userId }, data: { referralCode: code } })
      return code
    } catch {
      // unique violation → retry
    }
  }
  throw new Error("No se pudo generar código de referido")
}

/** Asegura que el user tenga código. Si ya tiene, lo devuelve. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  })
  if (u?.referralCode) return u.referralCode
  return generateReferralCodeForUser(userId)
}

/** Llama esto en signup cuando el user pasó un código de referido. Acredita 1 mes a ambos. */
export async function applyReferralOnSignup(newUserId: string, referredByCode: string): Promise<void> {
  const code = referredByCode.trim().toUpperCase()
  if (!code) return
  const referrer = await db.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  })
  if (!referrer || referrer.id === newUserId) return // sin-op si no existe o auto-referral

  await db.$transaction([
    db.user.update({
      where: { id: newUserId },
      data: { referredByCode: code, referralBonusMonths: { increment: 1 } },
    }),
    db.user.update({
      where: { id: referrer.id },
      data: { referralBonusMonths: { increment: 1 } },
    }),
  ])
}

/** Stats para mostrar al user en /configuracion/referidos */
export async function getReferralStats(userId: string): Promise<{
  code: string
  bonusMonths: number
  referredCount: number
  recent: Array<{ name: string; createdAt: Date }>
}> {
  const code = await ensureReferralCode(userId)
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { referralBonusMonths: true },
  })
  // Cuántos se registraron con este código
  const referred = await db.user.findMany({
    where: { referredByCode: code },
    select: { name: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  })
  return {
    code,
    bonusMonths: u?.referralBonusMonths ?? 0,
    referredCount: referred.length,
    recent: referred,
  }
}
