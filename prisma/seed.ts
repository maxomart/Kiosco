import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function main() {
  console.log("Iniciando seed de la base de datos...")

  // ============================================================
  // USUARIOS
  // ============================================================
  const superAdminPassword = await bcrypt.hash("SuperAdmin2026!", 12)
  const adminPassword = await bcrypt.hash("admin123", 12)
  const cashierPassword = await bcrypt.hash("cajero123", 12)

  // SUPER ADMIN: ve y administra todos los kioscos (tenantId = null)
  await db.user.upsert({
    where: { email: "superadmin@kiosco.com" },
    update: { role: "SUPER_ADMIN", active: true },
    create: {
      name: "Super Administrador",
      email: "superadmin@kiosco.com",
      password: superAdminPassword,
      role: "SUPER_ADMIN",
      tenantId: null,
    },
  })

  await db.user.upsert({
    where: { email: "admin@kiosco.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@kiosco.com",
      password: adminPassword,
      role: "OWNER",
    },
  })

  await db.user.upsert({
    where: { email: "cajero@kiosco.com" },
    update: {},
    create: {
      name: "Cajero/a",
      email: "cajero@kiosco.com",
      password: cashierPassword,
      role: "CASHIER",
    },
  })

  console.log("Usuarios creados")

  // ============================================================
  // CATEGORÍAS (tenantId = null para datos legacy)
  // ============================================================
  async function upsertCategory(name: string, color: string, icon: string) {
    const existing = await db.category.findFirst({ where: { name, tenantId: null } })
    if (existing) return existing
    return db.category.create({ data: { name, color, icon, tenantId: null } })
  }

  const categories = await Promise.all([
    upsertCategory("Bebidas", "#3b82f6", "Cup"),
    upsertCategory("Golosinas", "#f59e0b", "Candy"),
    upsertCategory("Cigarrillos", "#6b7280", "Cigarette"),
    upsertCategory("Almacén", "#10b981", "ShoppingBag"),
    upsertCategory("Lácteos", "#8b5cf6", "Milk"),
    upsertCategory("Limpieza", "#06b6d4", "Sparkles"),
    upsertCategory("Papelería", "#ec4899", "Pen"),
    upsertCategory("Snacks", "#f97316", "Cookie"),
  ])

  console.log("Categorías creadas")

  // ============================================================
  // PROVEEDORES
  // ============================================================
  async function upsertSupplier(name: string, cuit: string, phone: string) {
    const existing = await db.supplier.findFirst({ where: { cuit, tenantId: null } })
    if (existing) return existing
    return db.supplier.create({ data: { name, cuit, phone, tenantId: null } })
  }

  const suppliers = await Promise.all([
    upsertSupplier("Coca Cola FEMSA", "30-50000001-0", "0800-555-2632"),
    upsertSupplier("Distribuidora Norte", "30-50000002-0", "011-4555-0000"),
    upsertSupplier("Tabacalera Sarandí", "30-50000003-0", "011-4333-0000"),
  ])

  console.log("Proveedores creados")

  // ============================================================
  // PRODUCTOS DE EJEMPLO
  // ============================================================
  const [bebidas, golosinas, cigarrillos, almacen] = categories

  const products = [
    // Bebidas
    { name: "Coca Cola 500ml", barcode: "7790895000008", salePrice: 1200, costPrice: 900, stock: 48, categoryId: bebidas.id, supplierId: suppliers[0].id },
    { name: "Coca Cola 1.5lt", barcode: "7790895000015", salePrice: 2200, costPrice: 1600, stock: 24, categoryId: bebidas.id, supplierId: suppliers[0].id },
    { name: "Fanta Naranja 500ml", barcode: "7790895000022", salePrice: 1200, costPrice: 900, stock: 24, categoryId: bebidas.id },
    { name: "Sprite 500ml", barcode: "7790895000039", salePrice: 1200, costPrice: 900, stock: 18, categoryId: bebidas.id },
    { name: "Agua Mineral 500ml", barcode: "7790040003008", salePrice: 800, costPrice: 550, stock: 36, categoryId: bebidas.id },
    { name: "Agua Saborizada Manzana 500ml", barcode: "7790040003015", salePrice: 900, costPrice: 650, stock: 24, categoryId: bebidas.id },
    { name: "Powerade Naranja", barcode: "7790040003022", salePrice: 1500, costPrice: 1100, stock: 12, categoryId: bebidas.id },
    { name: "Red Bull 250ml", barcode: "90162735", salePrice: 3200, costPrice: 2400, stock: 10, categoryId: bebidas.id },

    // Golosinas
    { name: "Alfajor Oreo", barcode: "7794000523102", salePrice: 800, costPrice: 550, stock: 30, categoryId: golosinas.id },
    { name: "Alfajor Milka", barcode: "7794000523119", salePrice: 750, costPrice: 520, stock: 25, categoryId: golosinas.id },
    { name: "Bon o Bon x10", barcode: "7790580003008", salePrice: 1200, costPrice: 850, stock: 15, categoryId: golosinas.id },
    { name: "Chicle Beldent Menta", barcode: "7790580003015", salePrice: 400, costPrice: 280, stock: 50, categoryId: golosinas.id },
    { name: "Palito Fuego x50", barcode: "7790040003029", salePrice: 200, costPrice: 130, stock: 100, categoryId: golosinas.id },
    { name: "Caramelos Halls Mentol", barcode: "7790040003036", salePrice: 300, costPrice: 200, stock: 40, categoryId: golosinas.id },

    // Cigarrillos
    { name: "Marlboro Rojo x20", barcode: "07501032307987", salePrice: 2800, costPrice: 2200, stock: 20, minStock: 10, categoryId: cigarrillos.id, supplierId: suppliers[2].id, hasExpiry: true },
    { name: "Camel Filters x20", barcode: "07501032307994", salePrice: 2800, costPrice: 2200, stock: 15, minStock: 10, categoryId: cigarrillos.id, supplierId: suppliers[2].id, hasExpiry: true },
    { name: "Lucky Strike Azul x20", barcode: "07501032308001", salePrice: 2700, costPrice: 2100, stock: 10, minStock: 10, categoryId: cigarrillos.id, supplierId: suppliers[2].id, hasExpiry: true },

    // Almacén
    { name: "Galletitas Oreo x117g", barcode: "7794000522501", salePrice: 1100, costPrice: 750, stock: 20, categoryId: almacen.id },
    { name: "Papas Lays 130g", barcode: "7790580004001", salePrice: 1400, costPrice: 950, stock: 15, categoryId: almacen.id },
    { name: "Maní Salado La Abundancia", barcode: "7790895000046", salePrice: 900, costPrice: 620, stock: 12, categoryId: almacen.id },
  ]

  for (const productData of products) {
    const { stock, ...rest } = productData
    // Upsert: search by barcode + tenantId=null
    const existing = await db.product.findFirst({ where: { barcode: productData.barcode, tenantId: null } })
    if (existing) {
      await db.product.update({
        where: { id: existing.id },
        data: { salePrice: productData.salePrice, costPrice: productData.costPrice, stock },
      })
    } else {
      await db.product.create({
        data: {
          ...rest,
          stock,
          minStock: (productData as any).minStock ?? 5,
          idealStock: 20,
          profitPercent: ((productData.salePrice - productData.costPrice) / productData.costPrice) * 100,
          taxRate: "STANDARD",
          tenantId: null,
        },
      })
    }
  }

  console.log("Productos de ejemplo creados")

  // ============================================================
  // CATEGORÍAS DE GASTOS
  // ============================================================
  const expenseCategoryNames = ["Servicios", "Limpieza", "Sueldos", "Delivery", "Otros"]
  for (const name of expenseCategoryNames) {
    const existing = await db.expenseCategory.findFirst({ where: { name, tenantId: null } })
    if (!existing) {
      await db.expenseCategory.create({ data: { name, tenantId: null } })
    }
  }

  // ============================================================
  // CONFIGURACIÓN DEL NEGOCIO
  // ============================================================
  const configs = [
    { key: "business_name", value: "Mi Kiosco", description: "Nombre del negocio" },
    { key: "business_address", value: "Av. Corrientes 1234, CABA", description: "Dirección" },
    { key: "business_phone", value: "011-4555-0000", description: "Teléfono" },
    { key: "business_cuit", value: "20-12345678-0", description: "CUIT" },
    { key: "receipt_footer", value: "¡Gracias por su compra!", description: "Pie del ticket" },
    { key: "currency", value: "ARS", description: "Moneda" },
    { key: "loyalty_rate", value: "100", description: "Pesos por punto de fidelidad" },
  ]

  for (const config of configs) {
    const existing = await db.businessConfig.findFirst({ where: { key: config.key, tenantId: null } })
    if (!existing) {
      await db.businessConfig.create({ data: { ...config, tenantId: null } })
    }
  }

  console.log("Configuración del negocio creada")
  console.log("")
  console.log("Seed completado exitosamente!")
  console.log("")
  console.log("Credenciales de acceso:")
  console.log("   Dueño:  admin@kiosco.com  / admin123")
  console.log("   Cajero: cajero@kiosco.com / cajero123")
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
