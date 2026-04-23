import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { hasFeature } from "@/lib/permissions"
import { buildBusinessContext } from "@/lib/ai-context"
import type { Plan } from "@/lib/utils"

export const dynamic = "force-dynamic"

/**
 * Returns a list of *rule-based* insights derived from the business context.
 * Cheap (no LLM call), so we can show them in the bot bubble passively.
 * For deeper LLM-generated insights, the user opens the chat and asks.
 */

interface Insight {
  id: string
  severity: "info" | "warning" | "danger" | "success"
  title: string
  message: string
  action?: { label: string; href: string }
}

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const sub = await db.subscription.findUnique({
    where: { tenantId: tenantId! },
    select: { plan: true },
  })
  const plan = (sub?.plan as Plan) ?? "STARTER"

  // The widget itself is available to paid plans, but the live context is computed for everyone.
  if (!hasFeature(plan, "feature:ai_assistant")) {
    return NextResponse.json({ insights: [] })
  }

  try {
    const ctx = await buildBusinessContext(tenantId!, plan)
    const insights: Insight[] = []

    // 1. Out of stock
    if (ctx.inventory.outOfStock.length > 0) {
      insights.push({
        id: "out-of-stock",
        severity: "danger",
        title: `${ctx.inventory.outOfStock.length} producto${ctx.inventory.outOfStock.length === 1 ? "" : "s"} sin stock`,
        message: `${ctx.inventory.outOfStock.slice(0, 2).map((p) => p.name).join(", ")}${ctx.inventory.outOfStock.length > 2 ? "…" : ""} se quedaron sin stock. Reponelos para no perder ventas.`,
        action: { label: "Ver inventario", href: "/inventario?filter=outstock" },
      })
    }

    // 2. Low stock — and prioritize bestsellers
    if (ctx.inventory.lowStock.length > 0) {
      const sellersByName = new Map(ctx.topSellers7d.map((s) => [s.name, s]))
      const lowAndHot = ctx.inventory.lowStock.find((p) => sellersByName.has(p.name))
      if (lowAndHot) {
        const seller = sellersByName.get(lowAndHot.name)!
        insights.push({
          id: `low-bestseller-${lowAndHot.name}`,
          severity: "warning",
          title: `Stock bajo en un best-seller: ${lowAndHot.name}`,
          message: `Quedan ${lowAndHot.stock} unidades. La semana pasada vendiste ${seller.quantitySold}. Reponé pronto para no perder ventas.`,
          action: { label: "Reponer", href: "/inventario?filter=lowstock" },
        })
      } else {
        insights.push({
          id: "low-stock-generic",
          severity: "warning",
          title: `${ctx.inventory.lowStock.length} producto${ctx.inventory.lowStock.length === 1 ? "" : "s"} con stock bajo`,
          message: `Conviene reponer pronto. Revisá la lista en inventario.`,
          action: { label: "Ver lista", href: "/inventario?filter=lowstock" },
        })
      }
    }

    // 3. Sales trend vs yesterday
    if (ctx.yesterday.revenue > 0 && ctx.today.revenue > 0) {
      const change = ((ctx.today.revenue - ctx.yesterday.revenue) / ctx.yesterday.revenue) * 100
      if (change >= 30) {
        insights.push({
          id: "sales-spike",
          severity: "success",
          title: `Hoy vendés ${change.toFixed(0)}% más que ayer`,
          message: `Llevás $${Math.round(ctx.today.revenue).toLocaleString("es-AR")} vs $${Math.round(ctx.yesterday.revenue).toLocaleString("es-AR")} ayer. ¡Buen día!`,
        })
      } else if (change <= -30) {
        insights.push({
          id: "sales-drop",
          severity: "warning",
          title: `Ventas más bajas que ayer (${change.toFixed(0)}%)`,
          message: `¿Será el clima, un día especial? Revisá si hay algo que ajustar.`,
        })
      }
    }

    // 4. Cash open too long
    if (ctx.cashSession.isOpen && ctx.cashSession.sinceHours && ctx.cashSession.sinceHours >= 12) {
      insights.push({
        id: "cash-long-open",
        severity: "info",
        title: `Caja abierta hace ${ctx.cashSession.sinceHours}h`,
        message: `Recordá cerrar la caja al terminar el turno para llevar el control.`,
        action: { label: "Cerrar caja", href: "/caja" },
      })
    }

    // 5. Top sellers reminder
    if (ctx.topSellers7d.length > 0 && insights.length < 3) {
      const top = ctx.topSellers7d[0]
      insights.push({
        id: "top-seller",
        severity: "success",
        title: `Tu producto estrella: ${top.name}`,
        message: `Vendiste ${top.quantitySold} unidades en 7 días ($${Math.round(top.revenue).toLocaleString("es-AR")}). ¿Tenés stock suficiente?`,
      })
    }

    return NextResponse.json({ insights, plan })
  } catch (err) {
    console.error("[GET /api/ai/insights]", err)
    return NextResponse.json({ insights: [] })
  }
}
