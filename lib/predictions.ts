/**
 * IA predictiva — análisis estadístico simple sobre el historial real del
 * tenant. NO usa OpenAI (sería caro por tenant); en su lugar calcula
 * métricas determinísticas que son tan útiles como un modelo entrenado para
 * el dataset chico de un kiosco.
 *
 * 3 features:
 *   1. Predicción de quiebre — cuándo se va a agotar cada producto basado
 *      en velocidad de venta de los últimos 14 días
 *   2. Productos más rentables — top 5 por ganancia bruta del último mes
 *   3. Cierre estimado del día — proyección lineal de ventas hasta cierre
 *      basada en pace actual + promedio histórico del mismo día de la semana
 */

import { db } from "./db"

export interface StockoutPrediction {
  productId: string
  productName: string
  currentStock: number
  velocityPerDay: number
  daysUntilStockout: number | null // null si no hay velocidad
  stockoutDate: Date | null
  severity: "critical" | "warning" | "ok"
}

/** Calcula cuándo se va a agotar cada producto. Mira ventas últimos 14 días. */
export async function predictStockouts(tenantId: string): Promise<StockoutPrediction[]> {
  const now = new Date()
  const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  // Items vendidos en los últimos 14 días — agrupados por producto
  const sales = await db.sale.findMany({
    where: {
      tenantId,
      status: "COMPLETED",
      createdAt: { gte: since },
    },
    select: { items: { select: { productId: true, quantity: true } } },
  })
  const soldByProduct = new Map<string, number>()
  for (const s of sales) {
    for (const it of s.items) {
      soldByProduct.set(it.productId, (soldByProduct.get(it.productId) ?? 0) + it.quantity)
    }
  }

  const products = await db.product.findMany({
    where: { tenantId, active: true },
    select: { id: true, name: true, stock: true, minStock: true },
  })

  const results: StockoutPrediction[] = []
  for (const p of products) {
    const sold = soldByProduct.get(p.id) ?? 0
    const velocity = sold / 14 // unidades/día
    let daysUntilStockout: number | null = null
    let stockoutDate: Date | null = null
    let severity: StockoutPrediction["severity"] = "ok"

    if (velocity > 0 && p.stock > 0) {
      daysUntilStockout = Math.floor(p.stock / velocity)
      stockoutDate = new Date(now.getTime() + daysUntilStockout * 24 * 60 * 60 * 1000)
      if (daysUntilStockout <= 3) severity = "critical"
      else if (daysUntilStockout <= 7) severity = "warning"
    }

    if (p.stock === 0 && velocity > 0) {
      severity = "critical"
      daysUntilStockout = 0
      stockoutDate = now
    }

    results.push({
      productId: p.id,
      productName: p.name,
      currentStock: p.stock,
      velocityPerDay: Number(velocity.toFixed(2)),
      daysUntilStockout,
      stockoutDate,
      severity,
    })
  }

  // Sort: critical primero, después por daysUntilStockout asc
  results.sort((a, b) => {
    const sev: Record<string, number> = { critical: 0, warning: 1, ok: 2 }
    if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity]
    return (a.daysUntilStockout ?? Infinity) - (b.daysUntilStockout ?? Infinity)
  })

  return results
}

export interface ProductProfitability {
  productId: string
  productName: string
  unitsSold: number
  revenue: number
  cost: number
  profit: number
  marginPercent: number
}

/** Top productos por ganancia bruta del último mes. */
export async function getMostProfitable(tenantId: string, limit = 10): Promise<ProductProfitability[]> {
  const now = new Date()
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const sales = await db.sale.findMany({
    where: { tenantId, status: "COMPLETED", createdAt: { gte: since } },
    select: { items: { select: { productId: true, productName: true, quantity: true, unitPrice: true, costPrice: true, subtotal: true } } },
  })

  const map = new Map<string, ProductProfitability>()
  for (const s of sales) {
    for (const it of s.items) {
      const key = it.productId
      const r = map.get(key) ?? {
        productId: it.productId,
        productName: it.productName,
        unitsSold: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        marginPercent: 0,
      }
      const revenue = Number(it.subtotal)
      const cost = Number(it.costPrice) * it.quantity
      r.unitsSold += it.quantity
      r.revenue += revenue
      r.cost += cost
      r.profit += revenue - cost
      map.set(key, r)
    }
  }

  const list = Array.from(map.values()).map((r) => ({
    ...r,
    marginPercent: r.revenue > 0 ? Number(((r.profit / r.revenue) * 100).toFixed(1)) : 0,
  }))
  list.sort((a, b) => b.profit - a.profit)
  return list.slice(0, limit)
}

export interface DayCloseForecast {
  hourNow: number
  todaySoFar: number
  averageThisDayOfWeek: number
  estimatedClose: number
  confidence: "low" | "medium" | "high"
}

/**
 * Pronóstica el cierre del día. Combina:
 *   - Lo vendido hasta este momento (today)
 *   - Promedio histórico de los últimos 4 sábados (o el día de la semana
 *     que sea hoy)
 *   - Pace actual del día vs el mismo horario en días pasados
 */
export async function forecastDayClose(tenantId: string): Promise<DayCloseForecast> {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  // Hoy
  const todaySales = await db.sale.findMany({
    where: { tenantId, status: "COMPLETED", createdAt: { gte: startOfDay } },
    select: { total: true },
  })
  const todaySoFar = todaySales.reduce((s, x) => s + Number(x.total), 0)

  // Últimas 4 semanas, mismo día de la semana
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
  const recentSales = await db.sale.findMany({
    where: { tenantId, status: "COMPLETED", createdAt: { gte: fourWeeksAgo, lt: startOfDay } },
    select: { total: true, createdAt: true },
  })

  // Agrupar por día (YYYY-MM-DD), contar solo días con dayOfWeek igual
  const byDay = new Map<string, number>()
  for (const s of recentSales) {
    const d = new Date(s.createdAt)
    if (d.getDay() !== dayOfWeek) continue
    const key = d.toISOString().split("T")[0]
    byDay.set(key, (byDay.get(key) ?? 0) + Number(s.total))
  }
  const sameDayTotals = Array.from(byDay.values())
  const averageThisDayOfWeek = sameDayTotals.length > 0
    ? sameDayTotals.reduce((s, x) => s + x, 0) / sameDayTotals.length
    : 0

  // Pace adjustment: si ya pasó X% del día, escalar lo de hoy
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const hoursOpen = Math.max(7, Math.min(22, now.getHours())) - 7 // asumir 7am-22pm
  const dayProgressFactor = hoursOpen > 0 ? Math.min(1, (minutesNow - 7 * 60) / (15 * 60)) : 0

  let estimatedClose: number
  let confidence: DayCloseForecast["confidence"]
  if (sameDayTotals.length >= 3 && dayProgressFactor > 0.2) {
    // Mezcla 60% pace de hoy + 40% promedio histórico
    const pacedToday = dayProgressFactor > 0 ? todaySoFar / dayProgressFactor : todaySoFar
    estimatedClose = pacedToday * 0.6 + averageThisDayOfWeek * 0.4
    confidence = "high"
  } else if (averageThisDayOfWeek > 0) {
    estimatedClose = averageThisDayOfWeek
    confidence = "medium"
  } else {
    estimatedClose = todaySoFar
    confidence = "low"
  }

  return {
    hourNow: now.getHours(),
    todaySoFar: Number(todaySoFar.toFixed(2)),
    averageThisDayOfWeek: Number(averageThisDayOfWeek.toFixed(2)),
    estimatedClose: Number(estimatedClose.toFixed(2)),
    confidence,
  }
}
