import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { startOfDay, endOfDay, subDays } from "date-fns"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// GET /api/ia/resumen-dia
// Genera un resumen en lenguaje natural del rendimiento del día
export async function GET() {
  try {
    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    const yesterdayStart = startOfDay(subDays(now, 1))
    const yesterdayEnd = endOfDay(subDays(now, 1))

    const [today, yesterday, topItems, allActiveProducts] = await Promise.all([
      db.sale.aggregate({
        where: { createdAt: { gte: todayStart, lte: todayEnd }, status: "COMPLETED" },
        _sum: { total: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { createdAt: { gte: yesterdayStart, lte: yesterdayEnd }, status: "COMPLETED" },
        _sum: { total: true },
        _count: true,
      }),
      db.saleItem.groupBy({
        by: ["productName"],
        where: { sale: { createdAt: { gte: todayStart, lte: todayEnd }, status: "COMPLETED" } },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 3,
      }),
      // Filtrar low stock en JS para compatibilidad SQLite + PostgreSQL
      db.product.findMany({
        where: { active: true },
        select: { stock: true, minStock: true },
      }),
    ])

    const lowStock = allActiveProducts.filter(p => p.stock <= p.minStock).length

    const todayTotal = today._sum.total ?? 0
    const yesterdayTotal = yesterday._sum.total ?? 0
    const todayCount = today._count
    const yesterdayCount = yesterday._count

    const diff = yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : 0

    const prompt = `Estás generando un resumen ejecutivo del día para el dueño de un kiosco argentino.

DATOS:
- Ventas hoy: $${todayTotal.toFixed(0)} ARS en ${todayCount} transacciones
- Ventas ayer: $${yesterdayTotal.toFixed(0)} ARS en ${yesterdayCount} transacciones
- Variación vs ayer: ${diff.toFixed(1)}%
- Top 3 productos vendidos hoy: ${topItems.map(t => `${t.productName} (${t._sum.quantity})`).join(", ") || "Sin ventas aún"}
- Productos con stock bajo: ${lowStock}

Generá un resumen conciso en 2-3 oraciones, en tono amigable y profesional (usar "vos", no "usted").
Mencioná lo más relevante: comparación con ayer, producto destacado, y una sugerencia accionable si algo llama la atención.
NO uses markdown, emojis ni títulos. Solo texto plano de 2-3 oraciones.`

    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 400,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === "text")
    const summary = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "Sin datos suficientes aún."

    return NextResponse.json({
      summary,
      stats: {
        todayTotal,
        yesterdayTotal,
        diff,
        todayCount,
        lowStock,
      },
    })
  } catch (err) {
    console.error("[/api/ia/resumen-dia]", err)
    return NextResponse.json({ summary: null, error: "Error al generar resumen" }, { status: 500 })
  }
}
