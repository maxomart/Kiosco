import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { slugify } from "../lib/utils"

const db = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  // ── SUPER ADMIN ──────────────────────────────────────────────
  const superAdminPassword = await bcrypt.hash(
    process.env.SUPERADMIN_PASSWORD ?? "SuperAdmin2026!",
    12
  )
  const superAdmin = await db.user.upsert({
    where: { email: process.env.SUPERADMIN_EMAIL ?? "admin@retailar.app" },
    update: { role: "SUPER_ADMIN", active: true },
    create: {
      name: process.env.SUPERADMIN_NAME ?? "Super Admin",
      email: process.env.SUPERADMIN_EMAIL ?? "admin@retailar.app",
      password: superAdminPassword,
      role: "SUPER_ADMIN",
      tenantId: null,
    },
  })
  console.log("✅ Super Admin:", superAdmin.email)

  // ── DEMO TENANT: Kiosco Don Pedro ────────────────────────────
  const demoSlug = "kiosco-don-pedro"
  let demoTenant = await db.tenant.findUnique({ where: { slug: demoSlug } })

  if (!demoTenant) {
    demoTenant = await db.tenant.create({
      data: {
        name: "Kiosco Don Pedro",
        slug: demoSlug,
        active: true,
        config: {
          create: {
            businessName: "Kiosco Don Pedro",
            businessType: "KIOSCO",
            taxId: "20-12345678-9",
            phone: "011-1234-5678",
            email: "donpedro@gmail.com",
            timezone: "America/Argentina/Buenos_Aires",
            currency: "ARS",
          },
        },
        subscription: {
          create: {
            plan: "PROFESSIONAL",
            status: "ACTIVE",
            priceUSD: 60,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    })

    const ownerPassword = await bcrypt.hash("Demo2026!", 12)
    await db.user.create({
      data: {
        name: "Pedro García",
        email: "pedro@kioscodonpedro.com",
        password: ownerPassword,
        role: "OWNER",
        active: true,
        tenantId: demoTenant.id,
      },
    })
    await db.user.create({
      data: {
        name: "Ana Cajera",
        email: "ana@kioscodonpedro.com",
        password: await bcrypt.hash("Cajera2026!", 12),
        role: "CASHIER",
        active: true,
        tenantId: demoTenant.id,
      },
    })

    // Categories
    const categories = ["Bebidas", "Snacks", "Almacén", "Lácteos", "Limpieza", "Cigarrillos"]
    const createdCats: Record<string, string> = {}
    for (const name of categories) {
      const cat = await db.category.create({
        data: { name, tenantId: demoTenant.id },
      })
      createdCats[name] = cat.id
    }

    // Products
    const products = [
      { name: "Coca Cola 1.5L", barcode: "7790895000084", costPrice: 450, salePrice: 700, stock: 48, minStock: 10, categoryName: "Bebidas" },
      { name: "Sprite 500ml", barcode: "7790895000091", costPrice: 250, salePrice: 390, stock: 36, minStock: 12, categoryName: "Bebidas" },
      { name: "Agua Mineral 500ml", barcode: "7790895000108", costPrice: 120, salePrice: 200, stock: 60, minStock: 20, categoryName: "Bebidas" },
      { name: "Papas Fritas Lay's 55g", barcode: "7790040000015", costPrice: 350, salePrice: 550, stock: 24, minStock: 8, categoryName: "Snacks" },
      { name: "Alfajor Oreo", barcode: "7622210010100", costPrice: 180, salePrice: 290, stock: 30, minStock: 10, categoryName: "Snacks" },
      { name: "Chocolatada Serenísima", barcode: "7793750000028", costPrice: 320, salePrice: 490, stock: 18, minStock: 6, categoryName: "Lácteos" },
      { name: "Leche La Serenísima 1L", barcode: "7793750000004", costPrice: 380, salePrice: 580, stock: 24, minStock: 8, categoryName: "Lácteos" },
      { name: "Yerba Mate Cruz de Malta 500g", barcode: "7790070000010", costPrice: 1200, salePrice: 1850, stock: 20, minStock: 5, categoryName: "Almacén" },
      { name: "Azúcar Ledesma 1kg", barcode: "7790440000022", costPrice: 600, salePrice: 900, stock: 15, minStock: 5, categoryName: "Almacén" },
      { name: "Arroz Gallo 1kg", barcode: "7790620000033", costPrice: 700, salePrice: 1050, stock: 12, minStock: 4, categoryName: "Almacén" },
      { name: "Jabón Líquido Magistral 200ml", barcode: "7791290000044", costPrice: 450, salePrice: 700, stock: 20, minStock: 6, categoryName: "Limpieza" },
      { name: "Cigarrillos Marlboro 20u", barcode: "7796440000055", costPrice: 1100, salePrice: 1400, stock: 4, minStock: 10, categoryName: "Cigarrillos" },
    ]

    for (const p of products) {
      await db.product.create({
        data: {
          name: p.name,
          barcode: p.barcode,
          costPrice: p.costPrice,
          salePrice: p.salePrice,
          stock: p.stock,
          minStock: p.minStock,
          tenantId: demoTenant.id,
          categoryId: createdCats[p.categoryName],
        },
      })
    }

    // Demo client
    await db.client.create({
      data: {
        name: "María González",
        phone: "011-9876-5432",
        email: "maria@gmail.com",
        dni: "30123456",
        loyaltyPoints: 150,
        tenantId: demoTenant.id,
      },
    })

    console.log("✅ Demo Tenant: Kiosco Don Pedro")
  }

  // ── DEMO TENANT 2: Farmacia Sol ──────────────────────────────
  const farmSlug = "farmacia-sol"
  let farmTenant = await db.tenant.findUnique({ where: { slug: farmSlug } })

  if (!farmTenant) {
    farmTenant = await db.tenant.create({
      data: {
        name: "Farmacia Sol",
        slug: farmSlug,
        active: true,
        config: {
          create: {
            businessName: "Farmacia Sol",
            businessType: "FARMACIA",
            phone: "011-5555-1234",
          },
        },
        subscription: {
          create: {
            plan: "STARTER",
            status: "ACTIVE",
            priceUSD: 25,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    })

    await db.user.create({
      data: {
        name: "Laura Farmacéutica",
        email: "laura@farmaciasol.com",
        password: await bcrypt.hash("Farmacia2026!", 12),
        role: "OWNER",
        active: true,
        tenantId: farmTenant.id,
      },
    })
    console.log("✅ Demo Tenant: Farmacia Sol")
  }

  console.log("✅ Seed completo!")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
