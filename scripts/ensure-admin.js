// scripts/ensure-admin.js
// Corre en cada deploy: crea o verifica el Super Admin.
//
// Si SUPERADMIN_PASSWORD no está definida, se genera una aleatoria
// segura y se imprime UNA SOLA VEZ en los logs.
// En ese caso, copiá la password de los logs y guardala en un lugar seguro.

const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")
const crypto = require("crypto")

function generateSecurePassword(length) {
  const len = length || 18
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*"
  const bytes = crypto.randomBytes(len)
  let out = ""
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length]
  const arr = out.split("")
  if (!/[A-Z]/.test(out)) arr[0] = "X"
  if (!/[a-z]/.test(out)) arr[1] = "k"
  if (!/[0-9]/.test(out)) arr[2] = "7"
  if (!/[!@#$%&*]/.test(out)) arr[3] = "!"
  return arr.join("")
}

async function main() {
  const db = new PrismaClient()
  try {
    const email = (process.env.SUPERADMIN_EMAIL || "admin@retailar.app").toLowerCase().trim()
    const name = process.env.SUPERADMIN_NAME || "Super Admin"

    // Backfill: every existing user predates the email-verification
    // feature and is by definition a real account. Mark them all as
    // verified so we don't lock anyone out when the dashboard layout
    // starts enforcing emailVerified !== null. Idempotent — only
    // touches rows where the column is still null.
    try {
      const backfill = await db.user.updateMany({
        where: { emailVerified: null },
        data: { emailVerified: new Date() },
      })
      if (backfill.count > 0) {
        console.log(`[ensure-admin] backfilled emailVerified on ${backfill.count} existing users`)
      }
    } catch (e) {
      console.error("[ensure-admin] emailVerified backfill failed (non-blocking):", e.message)
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      const patch = {}
      if (existing.role !== "SUPER_ADMIN" || !existing.active) {
        patch.role = "SUPER_ADMIN"
        patch.active = true
      }
      // Super-admin must never be blocked by the verification gate.
      if (!existing.emailVerified) patch.emailVerified = new Date()
      if (Object.keys(patch).length > 0) {
        await db.user.update({ where: { email }, data: patch })
      }
      console.log(`[ensure-admin] Super Admin verificado: ${email}`)
      return
    }

    const envPassword = process.env.SUPERADMIN_PASSWORD
    if (envPassword && envPassword.length < 10) {
      throw new Error("SUPERADMIN_PASSWORD debe tener al menos 10 caracteres")
    }
    const generated = !envPassword
    const password = envPassword || generateSecurePassword(18)

    const hashed = await bcrypt.hash(password, 12)
    await db.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: "SUPER_ADMIN",
        active: true,
        emailVerified: new Date(),
      },
    })

    console.log("==========================================================")
    console.log(`[ensure-admin] Super Admin creado: ${email}`)
    if (generated) {
      console.log(`[ensure-admin] Password: ${password}`)
      console.log("[ensure-admin] Guardala AHORA — no se vuelve a mostrar.")
      console.log("[ensure-admin] Para fijarla, definí SUPERADMIN_PASSWORD en env.")
    } else {
      console.log("[ensure-admin] Password: (definida en SUPERADMIN_PASSWORD — no se imprime)")
    }
    console.log("==========================================================")
  } catch (err) {
    console.error("[ensure-admin] error (non-blocking):", err.message)
  } finally {
    await db.$disconnect()
  }
}

main()
