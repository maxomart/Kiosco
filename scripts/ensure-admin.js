// scripts/ensure-admin.js
// Corre en cada deploy: crea o verifica el Super Admin
const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

async function main() {
  const db = new PrismaClient()
  try {
    const email = process.env.SUPERADMIN_EMAIL || "admin@retailar.app"
    const password = process.env.SUPERADMIN_PASSWORD || "SuperAdmin2026!"
    const name = process.env.SUPERADMIN_NAME || "Super Admin"

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      await db.user.update({
        where: { email },
        data: { role: "SUPER_ADMIN", active: true },
      })
      console.log(`✅ Super Admin verificado: ${email}`)
    } else {
      const hashed = await bcrypt.hash(password, 12)
      await db.user.create({
        data: { name, email, password: hashed, role: "SUPER_ADMIN", active: true },
      })
      console.log(`✅ Super Admin creado: ${email}`)
    }
  } catch (err) {
    console.error("⚠️  ensure-admin error (non-blocking):", err.message)
  } finally {
    await db.$disconnect()
  }
}

main()
