import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/admin/support/tickets
// Query: ?filter=open|escalated|all  (default: all open-ish)
//
// Returns tickets sorted so unread + escalated come first.
export async function GET(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get("filter") ?? "active"

  const where: any = {}
  if (filter === "escalated") {
    where.status = "ESCALATED"
  } else if (filter === "open") {
    where.status = { in: ["OPEN", "AI_REPLIED", "ESCALATED"] }
  } else if (filter === "closed") {
    where.status = "CLOSED"
  } else if (filter === "active") {
    // default: anything not closed
    where.status = { not: "CLOSED" }
  }
  // "all" = no filter

  const tickets = await db.supportTicket.findMany({
    where,
    orderBy: [
      { unreadByAdmin: "desc" },
      { lastMessageAt: "desc" },
    ],
    take: 100,
  })

  // Pull author info for each ticket — just one batch query
  const userIds = Array.from(new Set(tickets.map((t) => t.userId)))
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, tenant: { select: { id: true, name: true } } },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  return NextResponse.json({
    tickets: tickets.map((t) => {
      const u = userMap.get(t.userId)
      return {
        id: t.id,
        subject: t.subject,
        status: t.status,
        plan: t.planSnapshot,
        unreadByAdmin: t.unreadByAdmin,
        escalatedAt: t.escalatedAt,
        closedAt: t.closedAt,
        lastMessageAt: t.lastMessageAt,
        createdAt: t.createdAt,
        user: u
          ? { id: u.id, name: u.name, email: u.email, tenant: u.tenant ?? null }
          : null,
      }
    }),
    counts: await aggregateCounts(),
  })
}

async function aggregateCounts() {
  const [open, escalated, closed] = await Promise.all([
    db.supportTicket.count({ where: { status: { in: ["OPEN", "AI_REPLIED"] } } }),
    db.supportTicket.count({ where: { status: "ESCALATED" } }),
    db.supportTicket.count({ where: { status: "CLOSED" } }),
  ])
  return { open, escalated, closed }
}
