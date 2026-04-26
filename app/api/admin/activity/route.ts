import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * GET /api/admin/activity
 *
 * Cross-tenant activity stream for the super-admin dashboard. Pulls a
 * mixed feed from a few sources, sorts by createdAt desc, returns 30
 * most recent items. Each item has a `kind` so the UI can pick an icon
 * and color.
 *
 *   - signup:        new tenant created
 *   - subscription:  ACTIVE / TRIALING / CANCELLED transitions
 *   - invoice-paid:  invoice flipped to PAID
 *   - invoice-failed: invoice FAILED
 *   - sale:          recent big sale (top 5 today)
 *
 * The dashboard polls this every ~10s.
 */

type ActivityKind =
  | "signup"
  | "subscription"
  | "invoice-paid"
  | "invoice-failed"
  | "sale-big"

type Activity = {
  id: string
  kind: ActivityKind
  createdAt: string
  title: string
  detail: string
  tenantId?: string
  tenantName?: string
}

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [signups, subUpdates, invoices, bigSales] = await Promise.all([
    db.tenant.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        name: true,
        createdAt: true,
        subscription: { select: { plan: true } },
      },
    }),
    db.subscription.findMany({
      where: { updatedAt: { gte: since }, status: { in: ["ACTIVE", "CANCELLED", "TRIALING"] } },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: {
        id: true,
        plan: true,
        status: true,
        updatedAt: true,
        tenant: { select: { id: true, name: true } },
      },
    }),
    db.invoice.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        subscription: {
          select: { tenant: { select: { id: true, name: true } } },
        },
      },
    }),
    db.sale.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
        status: "COMPLETED",
      },
      orderBy: { total: "desc" },
      take: 5,
      select: {
        id: true,
        total: true,
        createdAt: true,
        tenant: { select: { id: true, name: true } },
      },
    }),
  ])

  const items: Activity[] = []

  for (const s of signups) {
    items.push({
      id: `signup-${s.id}`,
      kind: "signup",
      createdAt: s.createdAt.toISOString(),
      title: s.name,
      detail: `Nuevo tenant · ${s.subscription?.plan ?? "FREE"}`,
      tenantId: s.id,
      tenantName: s.name,
    })
  }

  for (const u of subUpdates) {
    if (!u.tenant) continue
    const label =
      u.status === "CANCELLED"
        ? "Canceló"
        : u.status === "ACTIVE"
          ? "Activó"
          : "Trial"
    items.push({
      id: `sub-${u.id}-${u.updatedAt.getTime()}`,
      kind: "subscription",
      createdAt: u.updatedAt.toISOString(),
      title: u.tenant.name,
      detail: `${label} · plan ${u.plan}`,
      tenantId: u.tenant.id,
      tenantName: u.tenant.name,
    })
  }

  for (const i of invoices) {
    const tenant = i.subscription?.tenant
    if (!tenant) continue
    if (i.status === "PAID" || i.status === "FAILED") {
      const amount = Number(i.amount).toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
      })
      items.push({
        id: `invoice-${i.id}`,
        kind: i.status === "PAID" ? "invoice-paid" : "invoice-failed",
        createdAt: i.createdAt.toISOString(),
        title: tenant.name,
        detail: `${i.status === "PAID" ? "Pagó" : "Falló"} ${amount}`,
        tenantId: tenant.id,
        tenantName: tenant.name,
      })
    }
  }

  for (const s of bigSales) {
    if (!s.tenant) continue
    const amount = Number(s.total).toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    })
    items.push({
      id: `bigsale-${s.id}`,
      kind: "sale-big",
      createdAt: s.createdAt.toISOString(),
      title: s.tenant.name,
      detail: `Venta grande · ${amount}`,
      tenantId: s.tenant.id,
      tenantName: s.tenant.name,
    })
  }

  // Sort desc, cap to 30
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return NextResponse.json({ items: items.slice(0, 30) })
}
