/**
 * Bot que simula un kiosco real corriendo todos los días — útil para tener
 * un tenant demo con datos vivos para hacer videos, pruebas y mostrar a
 * clientes potenciales.
 *
 * Configuración:
 *   - Crear el tenant via signup normal (por ejemplo: demo@cobraorvex.com)
 *   - Setear env var BOT_TENANT_EMAIL con ese email
 *   - El cron interno dispara runDailyBotSimulation() todos los días 23:30 AR
 *
 * Lo que hace:
 *   - Setup inicial (idempotente): si el tenant tiene <5 productos, crea
 *     un catálogo típico de kiosco argentino (~30 productos), 4 proveedores
 *     y 5 clientes con cuenta corriente
 *   - Daily run: 10-25 ventas distribuidas durante el día con productos
 *     random respetando stock, métodos de pago variados, gastos ocasionales,
 *     y cargas (recharges) cuando un producto baja del minStock
 */

import { db } from "./db"

// Catálogo base — productos típicos de un kiosco argentino con costos y precios
// realistas. costPrice / salePrice / minStock razonables.
interface SeedProduct {
  name: string
  category: string
  costPrice: number
  salePrice: number
  initialStock: number
  minStock: number
  weight: number // probabilidad relativa de aparecer en una venta (0-10)
  supplier: string
}

const SEED_PRODUCTS: SeedProduct[] = [
  // Bebidas — alta rotación
  { name: "Coca-Cola 500ml",       category: "Bebidas",    costPrice: 700,  salePrice: 1200, initialStock: 60, minStock: 12, weight: 10, supplier: "Coca-Cola Embotelladora" },
  { name: "Coca-Cola 2L",          category: "Bebidas",    costPrice: 1800, salePrice: 2900, initialStock: 30, minStock: 6,  weight: 7,  supplier: "Coca-Cola Embotelladora" },
  { name: "Pepsi 500ml",           category: "Bebidas",    costPrice: 650,  salePrice: 1100, initialStock: 40, minStock: 10, weight: 6,  supplier: "Distribuidora Pepsico" },
  { name: "Sprite 500ml",          category: "Bebidas",    costPrice: 700,  salePrice: 1200, initialStock: 30, minStock: 8,  weight: 5,  supplier: "Coca-Cola Embotelladora" },
  { name: "Fanta 500ml",           category: "Bebidas",    costPrice: 700,  salePrice: 1200, initialStock: 25, minStock: 6,  weight: 4,  supplier: "Coca-Cola Embotelladora" },
  { name: "Agua mineral 500ml",    category: "Bebidas",    costPrice: 350,  salePrice: 700,  initialStock: 50, minStock: 10, weight: 8,  supplier: "Distribuidora del Norte" },
  { name: "Gatorade 500ml",        category: "Bebidas",    costPrice: 900,  salePrice: 1500, initialStock: 20, minStock: 5,  weight: 3,  supplier: "Distribuidora Pepsico" },
  { name: "Speed energy",          category: "Bebidas",    costPrice: 800,  salePrice: 1400, initialStock: 25, minStock: 6,  weight: 4,  supplier: "Distribuidora del Norte" },
  { name: "Cerveza Quilmes 1L",    category: "Bebidas",    costPrice: 1300, salePrice: 2200, initialStock: 30, minStock: 8,  weight: 6,  supplier: "Distribuidora Quilmes" },

  // Cigarrillos — alta rotación, bajo margen
  { name: "Marlboro Box",          category: "Cigarrillos",costPrice: 2800, salePrice: 3500, initialStock: 40, minStock: 10, weight: 9,  supplier: "Mayorista Lavalle" },
  { name: "Philip Morris Box",     category: "Cigarrillos",costPrice: 2500, salePrice: 3200, initialStock: 35, minStock: 10, weight: 7,  supplier: "Mayorista Lavalle" },
  { name: "Lucky Strike Box",      category: "Cigarrillos",costPrice: 2700, salePrice: 3400, initialStock: 25, minStock: 6,  weight: 5,  supplier: "Mayorista Lavalle" },
  { name: "Camel Box",             category: "Cigarrillos",costPrice: 2900, salePrice: 3700, initialStock: 20, minStock: 5,  weight: 3,  supplier: "Mayorista Lavalle" },

  // Snacks
  { name: "Alfajor Jorgito",       category: "Snacks",     costPrice: 280,  salePrice: 500,  initialStock: 50, minStock: 12, weight: 8,  supplier: "Distribuidora del Norte" },
  { name: "Alfajor Capitán",       category: "Snacks",     costPrice: 380,  salePrice: 700,  initialStock: 40, minStock: 10, weight: 6,  supplier: "Distribuidora del Norte" },
  { name: "Alfajor Guaymallén",    category: "Snacks",     costPrice: 220,  salePrice: 400,  initialStock: 60, minStock: 15, weight: 9,  supplier: "Distribuidora del Norte" },
  { name: "Galletitas Oreo",       category: "Snacks",     costPrice: 700,  salePrice: 1200, initialStock: 30, minStock: 6,  weight: 4,  supplier: "Distribuidora del Norte" },
  { name: "Pringles original",     category: "Snacks",     costPrice: 1500, salePrice: 2400, initialStock: 25, minStock: 5,  weight: 3,  supplier: "Distribuidora del Norte" },
  { name: "Lays clásicas",         category: "Snacks",     costPrice: 600,  salePrice: 1100, initialStock: 35, minStock: 8,  weight: 5,  supplier: "Distribuidora Pepsico" },
  { name: "Doritos queso",         category: "Snacks",     costPrice: 700,  salePrice: 1300, initialStock: 30, minStock: 6,  weight: 5,  supplier: "Distribuidora Pepsico" },
  { name: "Chocolate Milka 100g",  category: "Snacks",     costPrice: 1000, salePrice: 1800, initialStock: 25, minStock: 5,  weight: 3,  supplier: "Distribuidora del Norte" },
  { name: "Chicles Beldent",       category: "Snacks",     costPrice: 250,  salePrice: 500,  initialStock: 80, minStock: 20, weight: 7,  supplier: "Distribuidora del Norte" },

  // Almacén — productos básicos
  { name: "Yerba La Salada 1kg",   category: "Almacén",    costPrice: 2200, salePrice: 3500, initialStock: 20, minStock: 4,  weight: 3,  supplier: "Mayorista Lavalle" },
  { name: "Azúcar Ledesma 1kg",    category: "Almacén",    costPrice: 1100, salePrice: 1800, initialStock: 25, minStock: 5,  weight: 3,  supplier: "Mayorista Lavalle" },
  { name: "Aceite Natura 900ml",   category: "Almacén",    costPrice: 1900, salePrice: 3000, initialStock: 15, minStock: 3,  weight: 2,  supplier: "Mayorista Lavalle" },
  { name: "Pan lactal Bimbo",      category: "Almacén",    costPrice: 1300, salePrice: 2200, initialStock: 12, minStock: 4,  weight: 4,  supplier: "Distribuidora del Norte" },
  { name: "Leche La Serenísima 1L",category: "Almacén",    costPrice: 900,  salePrice: 1500, initialStock: 25, minStock: 8,  weight: 5,  supplier: "Distribuidora del Norte" },
  { name: "Huevos x6",             category: "Almacén",    costPrice: 1400, salePrice: 2300, initialStock: 18, minStock: 5,  weight: 4,  supplier: "Distribuidora del Norte" },
  { name: "Caramelos Sugus",       category: "Snacks",     costPrice: 300,  salePrice: 600,  initialStock: 70, minStock: 15, weight: 6,  supplier: "Distribuidora del Norte" },
  { name: "Vasos descartables x10",category: "Almacén",    costPrice: 800,  salePrice: 1400, initialStock: 20, minStock: 4,  weight: 2,  supplier: "Mayorista Lavalle" },
]

const SUPPLIERS = [
  { name: "Coca-Cola Embotelladora", phone: "+54 11 4000-1111", email: "ventas@cocacola.com.ar" },
  { name: "Distribuidora Pepsico",   phone: "+54 11 4000-2222", email: "pedidos@pepsico.com.ar" },
  { name: "Distribuidora del Norte", phone: "+54 11 4000-3333", email: "pedidos@distnorte.com.ar" },
  { name: "Mayorista Lavalle",       phone: "+54 11 4000-4444", email: "info@mayoristalavalle.com" },
  { name: "Distribuidora Quilmes",   phone: "+54 11 4000-5555", email: "ventas@quilmes.com.ar" },
]

const SEED_CLIENTS = [
  { name: "Don Roberto",    phone: "+54 11 5555-1010" },
  { name: "Doña María",     phone: "+54 11 5555-1011" },
  { name: "El flaco Pedro", phone: "+54 11 5555-1012" },
  { name: "Sandra (esquina)", phone: "+54 11 5555-1013" },
  { name: "Carlos taxista", phone: "+54 11 5555-1014" },
]

// ──────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Pick weighted random — weight=10 más frecuente que weight=1 */
function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const i of items) {
    r -= i.weight
    if (r <= 0) return i
  }
  return items[items.length - 1]
}

/** Genera N timestamps en una ventana de ±30 min alrededor de `center`.
 *  Usado cuando el bot corre por slot (mañana/mediodía/tarde/etc) — las
 *  ventas se generan en el momento real para que se vea como un kiosco vivo. */
function generateNearbyTimestamps(center: Date, count: number): Date[] {
  const result: Date[] = []
  for (let i = 0; i < count; i++) {
    const offsetMs = (Math.random() - 0.5) * 60 * 60 * 1000 // ±30 min
    result.push(new Date(center.getTime() + offsetMs))
  }
  result.sort((a, b) => a.getTime() - b.getTime())
  return result
}

const PAYMENT_METHODS = [
  { method: "CASH", weight: 50 },
  { method: "MERCADOPAGO", weight: 30 },
  { method: "DEBIT", weight: 15 },
  { method: "CREDIT", weight: 5 },
]

function pickPaymentMethod(): string {
  return pickWeighted(PAYMENT_METHODS).method
}

// ──────────────────────────────────────────────────────────────────────────
// SETUP INICIAL (idempotente)
// ──────────────────────────────────────────────────────────────────────────

export async function seedKioskoCatalog(tenantId: string): Promise<{ seeded: boolean; productsCreated: number }> {
  const existing = await db.product.count({ where: { tenantId } })
  if (existing >= 5) return { seeded: false, productsCreated: 0 }

  console.log(`[bot] seeding catálogo para tenant ${tenantId}...`)

  // Categorías
  const categoryNames = [...new Set(SEED_PRODUCTS.map((p) => p.category))]
  const categoryIds: Record<string, string> = {}
  for (const name of categoryNames) {
    const cat = await db.category.create({
      data: { name, tenantId },
    }).catch(async () => {
      const ex = await db.category.findFirst({ where: { tenantId, name } })
      return ex!
    })
    categoryIds[name] = cat.id
  }

  // Proveedores
  const supplierIds: Record<string, string> = {}
  for (const s of SUPPLIERS) {
    const sup = await db.supplier.create({
      data: { ...s, tenantId },
    }).catch(async () => {
      const ex = await db.supplier.findFirst({ where: { tenantId, name: s.name } })
      return ex!
    })
    supplierIds[s.name] = sup.id
  }

  // Productos
  let created = 0
  for (const p of SEED_PRODUCTS) {
    await db.product.create({
      data: {
        name: p.name,
        salePrice: p.salePrice,
        costPrice: p.costPrice,
        stock: p.initialStock,
        minStock: p.minStock,
        tenantId,
        categoryId: categoryIds[p.category],
        supplierId: supplierIds[p.supplier],
      },
    })
    created++
  }

  // Clientes con cuenta corriente
  for (const c of SEED_CLIENTS) {
    await db.client.create({
      data: { ...c, tenantId },
    })
  }

  return { seeded: true, productsCreated: created }
}

// ──────────────────────────────────────────────────────────────────────────
// DAILY SIMULATION
// ──────────────────────────────────────────────────────────────────────────

interface DailyResult {
  salesCreated: number
  itemsSold: number
  rechargesCreated: number
  expensesCreated: number
  revenue: number
  slot?: BotSlot
}

export type BotSlot = "morning" | "noon" | "afternoon" | "evening" | "night" | "manual"

interface BotRunOpts {
  slot?: BotSlot
  /** Cantidad de ventas a generar. Default: depende del slot (3-6 por slot) */
  salesCount?: number
  /** Si true, intenta reponer stock con cargas. Default: solo en slot "night" o "manual" */
  doRecharges?: boolean
  /** Si true, registra un gasto random (~30% prob). Default: solo en slot "night" o "manual" */
  doExpenses?: boolean
}

export async function runDailyBotSimulation(
  tenantId: string,
  opts: BotRunOpts = {}
): Promise<DailyResult> {
  const slot: BotSlot = opts.slot ?? "manual"
  const isFinalSlot = slot === "night" || slot === "manual"
  const doRecharges = opts.doRecharges ?? isFinalSlot
  const doExpenses = opts.doExpenses ?? isFinalSlot
  // Setup si está vacío
  await seedKioskoCatalog(tenantId)

  // Owner para userId en sales / cashSession
  const owner = await db.user.findFirst({
    where: { tenantId, role: "OWNER" },
    select: { id: true },
  })
  if (!owner) throw new Error("Tenant sin OWNER — no puedo simular ventas")

  // Asegurar caja abierta
  let cashSession = await db.cashSession.findFirst({
    where: { tenantId, status: "OPEN" },
    select: { id: true },
  })
  if (!cashSession) {
    cashSession = await db.cashSession.create({
      data: {
        tenantId,
        userId: owner.id,
        openingBalance: 10000,
        status: "OPEN",
      },
      select: { id: true },
    })
  }

  // Productos disponibles para vender
  const products = await db.product.findMany({
    where: { tenantId, active: true, stock: { gt: 0 } },
    select: { id: true, name: true, salePrice: true, costPrice: true, stock: true, supplierId: true, minStock: true },
  })
  if (products.length === 0) throw new Error("Sin productos en stock")

  // Mapear seed weights por nombre
  const weightByName = new Map(SEED_PRODUCTS.map((p) => [p.name, p.weight]))

  // Cantidad de ventas: si el slot lo especifica, lo usamos; sino default
  // por slot (3-6 por slot intermedio, 4-7 para "manual" suelto).
  const numSales = opts.salesCount ?? (slot === "manual" ? randInt(8, 15) : randInt(3, 6))
  // Timestamps en ventana de ±30 min alrededor del momento actual — ventas
  // que parecen del momento real, no de un dump nocturno.
  const timestamps = generateNearbyTimestamps(new Date(), numSales)

  // Última number usado
  const lastSale = await db.sale.findFirst({
    where: { tenantId },
    orderBy: { number: "desc" },
    select: { number: true },
  })
  let nextSaleNumber = (lastSale?.number ?? 0) + 1

  // Tracking del stock en memoria — no consultamos la DB en cada venta
  const stockMap = new Map(products.map((p) => [p.id, { ...p, currentStock: p.stock }]))

  let salesCreated = 0
  let itemsSold = 0
  let revenue = 0

  for (const ts of timestamps) {
    // Items por venta — peso hacia 1-3 items
    const itemsCount = randInt(1, 5)
    const saleItems: Array<{ productId: string; quantity: number; productName: string; unitPrice: number; costPrice: number; subtotal: number }> = []

    for (let i = 0; i < itemsCount; i++) {
      // Pick por weight
      const candidates = Array.from(stockMap.values())
        .filter((p) => p.currentStock > 0 && !saleItems.some((it) => it.productId === p.id))
        .map((p) => ({ ...p, weight: weightByName.get(p.name) ?? 3 }))
      if (candidates.length === 0) break
      const picked = pickWeighted(candidates)

      const qty = Math.min(picked.currentStock, randInt(1, 2))
      const unitPrice = Number(picked.salePrice)
      const costPrice = Number(picked.costPrice)
      const subtotal = unitPrice * qty
      saleItems.push({
        productId: picked.id,
        quantity: qty,
        productName: picked.name,
        unitPrice,
        costPrice,
        subtotal,
      })
      // Descontar del stock en memoria
      const ref = stockMap.get(picked.id)!
      ref.currentStock -= qty
    }

    if (saleItems.length === 0) continue

    const subtotalSale = saleItems.reduce((s, it) => s + it.subtotal, 0)
    const total = subtotalSale
    const paymentMethod = pickPaymentMethod()
    const useClient = Math.random() < 0.15
    let clientId: string | null = null
    if (useClient) {
      const c = await db.client.findFirst({ where: { tenantId } })
      clientId = c?.id ?? null
    }

    // Crear la venta
    const sale = await db.sale.create({
      data: {
        number: nextSaleNumber++,
        subtotal: subtotalSale,
        total,
        paymentMethod,
        status: "COMPLETED",
        tenantId,
        userId: owner.id,
        clientId,
        cashSessionId: cashSession.id,
        createdAt: ts,
        updatedAt: ts,
        items: {
          create: saleItems.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            costPrice: it.costPrice,
            subtotal: it.subtotal,
          })),
        },
      },
    })

    // Descontar stock real + StockMovement
    for (const it of saleItems) {
      const before = stockMap.get(it.productId)!.currentStock + it.quantity
      const after = before - it.quantity
      await db.product.update({
        where: { id: it.productId },
        data: { stock: { decrement: it.quantity } },
      })
      await db.stockMovement.create({
        data: {
          type: "SALE",
          quantity: -it.quantity,
          stockBefore: before,
          stockAfter: after,
          reference: `Venta #${sale.number}`,
          productId: it.productId,
          userId: owner.id,
          createdAt: ts,
        },
      })
    }

    salesCreated++
    itemsSold += saleItems.reduce((s, it) => s + it.quantity, 0)
    revenue += total
  }

  // Reposición de stock — sólo en slot final (night/manual). En los slots
  // intermedios no rellenamos para no saturar la DB con cargas todo el día.
  let rechargesCreated = 0
  if (doRecharges) {
    const allProducts = await db.product.findMany({
      where: { tenantId },
      select: { id: true, name: true, costPrice: true, stock: true, minStock: true, supplierId: true },
    })
    const needsRestock = allProducts.filter((p) => p.stock < p.minStock && p.supplierId)

    const lastRecharge = await db.recharge.findFirst({
      where: { tenantId },
      orderBy: { number: "desc" },
      select: { number: true },
    })
    let nextRechargeNumber = (lastRecharge?.number ?? 0) + 1

    if (needsRestock.length > 0) {
    // Agrupar por supplier
    const bySupplier = new Map<string, typeof needsRestock>()
    for (const p of needsRestock) {
      const list = bySupplier.get(p.supplierId!) ?? []
      list.push(p)
      bySupplier.set(p.supplierId!, list)
    }

    for (const [supplierId, items] of bySupplier) {
      let totalCost = 0
      const rechargeItems = items.map((p) => {
        const restockQty = Math.max(p.minStock * 3 - p.stock, p.minStock * 2)
        const unitCost = Number(p.costPrice)
        const itemCost = unitCost * restockQty
        totalCost += itemCost
        return {
          quantity: restockQty,
          unitCost,
          totalCost: itemCost,
          productName: p.name,
          productId: p.id,
        }
      })

      await db.recharge.create({
        data: {
          number: nextRechargeNumber++,
          tenantId,
          supplierId,
          cost: totalCost,
          profit: 0,
          amount: totalCost,
          notes: "Reposición automática (bot)",
          items: { create: rechargeItems },
        },
      })

      // Sumar el stock real
      for (const item of rechargeItems) {
        const product = await db.product.findUnique({
          where: { id: item.productId },
          select: { stock: true },
        })
        const before = product?.stock ?? 0
        const after = before + item.quantity
        await db.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        })
        await db.stockMovement.create({
          data: {
            type: "PURCHASE",
            quantity: item.quantity,
            stockBefore: before,
            stockAfter: after,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
            reference: `Carga #${nextRechargeNumber - 1}`,
            productId: item.productId,
            userId: owner.id,
          },
        })
      }
      rechargesCreated++
    }
    } // cierra if (needsRestock)
  } // cierra if (doRecharges)

  // Gasto ocasional (~30% probabilidad) — sólo en slot final
  let expensesCreated = 0
  if (doExpenses && Math.random() < 0.3) {
    const expenseTypes = [
      { category: "Servicios", amount: randInt(15000, 35000), notes: "Luz / internet" },
      { category: "Sueldos",   amount: randInt(80000, 150000), notes: "Sueldo cajero" },
      { category: "Limpieza",  amount: randInt(3000, 8000), notes: "Insumos limpieza" },
      { category: "Otros",     amount: randInt(2000, 10000), notes: "Varios" },
    ]
    const e = rand(expenseTypes)
    await db.expense.create({
      data: { ...e, tenantId },
    })
    expensesCreated = 1
  }

  return {
    salesCreated,
    itemsSold,
    rechargesCreated,
    expensesCreated,
    revenue,
    slot,
  }
}

/**
 * Run del bot — busca el tenant configurado en BOT_TENANT_EMAIL y dispara
 * la simulación. Pensado para llamarse desde el cron interno.
 */
export async function runBotIfConfigured(
  opts: BotRunOpts = {}
): Promise<{ ok: boolean; reason?: string; result?: DailyResult; tenantId?: string }> {
  const email = process.env.BOT_TENANT_EMAIL
  if (!email) return { ok: false, reason: "BOT_TENANT_EMAIL no configurado" }

  const owner = await db.user.findUnique({
    where: { email },
    select: { tenantId: true },
  })
  if (!owner?.tenantId) return { ok: false, reason: `No hay user con email ${email}` }

  const result = await runDailyBotSimulation(owner.tenantId, opts)
  return { ok: true, result, tenantId: owner.tenantId }
}
