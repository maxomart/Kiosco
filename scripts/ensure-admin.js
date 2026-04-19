// ============================================================
// ensure-admin.js
// Se ejecuta en cada deploy para garantizar que existe el
// usuario SUPER_ADMIN. Idempotente: si ya existe, no hace nada.
//
// Credenciales por defecto (se pueden sobreescribir con ENV):
//   SUPERADMIN_EMAIL     (default: superadmin@kiosco.com)
//   SUPERADMIN_PASSWORD  (default: SuperAdmin2026!)
//   SUPERADMIN_NAME      (default: Super Administrador)
// ============================================================

const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const EMAIL = process.env.SUPERADMIN_EMAIL || "superadmin@kiosco.com"
const PASSWORD = process.env.SUPERADMIN_PASSWORD || "SuperAdmin2026!"
const NAME = process.env.SUPERADMIN_NAME || "Super Administrador"

async function main() {
  const db = new PrismaClient()

  try {
    const existing = await db.user.findUnique({ where: { email: EMAIL } })

    if (existing) {
      // Asegura que el rol siga siendo SUPER_ADMIN y esté activo
      if (existing.role !== "SUPER_ADMIN" || !existing.active) {
        await db.user.update({
          where: { id: existing.id },
          data: { role: "SUPER_ADMIN", active: true },
        })
        console.log("[ensure-admin] SuperAdmin actualizado: " + EMAIL)
      } else {
        console.log("[ensure-admin] SuperAdmin ya existe: " + EMAIL)
      }
      return
    }

    const hashed = await bcrypt.hash(PASSWORD, 12)

    await db.user.create({
      data: {
        name: NAME,
        email: EMAIL,
        password: hashed,
        role: "SUPER_ADMIN",
        active: true,
        tenantId: null,
      },
    })

    console.log("========================================")
    console.log("[ensure-admin] SuperAdmin creado")
    console.log("Email:    " + EMAIL)
    console.log("Password: " + PASSWORD)
    console.log("========================================")
  } catch (err) {
    console.error("[ensure-admin] Error:", err && err.message ? err.message : err)
    // No bloqueamos el deploy si el seed falla — el admin puede crearse después.
    process.exitCode = 0
  } finally {
    await db.$disconnect()
  }
}

main()
