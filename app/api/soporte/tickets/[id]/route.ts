import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/soporte/tickets/[id] — full thread for a ticket. Marks as read
// by the user.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { id } = await params

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      // Cap to defend against runaway threads. 200 turns is way more than
      // any real support conversation; if we hit that we should be
      // splitting the ticket anyway.
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  })
  if (!ticket || ticket.userId !== session.user.id) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 })
  }

  // Mark as read by user
  if (ticket.unreadByUser) {
    await db.supportTicket.update({
      where: { id },
      data: { unreadByUser: false },
    })
  }

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt,
      lastMessageAt: ticket.lastMessageAt,
      messages: ticket.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    },
  })
}
