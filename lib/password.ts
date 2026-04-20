import crypto from "crypto"
import { z } from "zod"

/**
 * Genera una contraseña aleatoria criptográficamente segura.
 * Usa crypto.randomBytes (CSPRNG). NO usar Math.random() para credenciales.
 */
export function generateSecurePassword(length = 18): string {
  if (length < 12) length = 12
  // Excluye chars ambiguos (0, O, 1, l, I) para que se lea bien al dictar
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*"
  const bytes = crypto.randomBytes(length)
  let out = ""
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length]
  }
  return ensureComplexity(out)
}

function ensureComplexity(pass: string): string {
  const hasUpper = /[A-Z]/.test(pass)
  const hasLower = /[a-z]/.test(pass)
  const hasDigit = /[0-9]/.test(pass)
  const hasSym = /[!@#$%&*]/.test(pass)
  if (hasUpper && hasLower && hasDigit && hasSym) return pass
  const arr = pass.split("")
  if (!hasUpper) arr[0] = "X"
  if (!hasLower) arr[1] = "k"
  if (!hasDigit) arr[2] = "7"
  if (!hasSym) arr[3] = "!"
  return arr.join("")
}

/**
 * Schema Zod para validar contraseñas fuertes en creación/cambio.
 * Requisitos: min 10 chars, mayúscula, minúscula, número.
 */
export const strongPasswordSchema = z
  .string()
  .min(10, "Mínimo 10 caracteres")
  .max(128, "Máximo 128 caracteres")
  .refine((v) => /[A-Z]/.test(v), "Debe contener al menos una mayúscula")
  .refine((v) => /[a-z]/.test(v), "Debe contener al menos una minúscula")
  .refine((v) => /[0-9]/.test(v), "Debe contener al menos un número")

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}
