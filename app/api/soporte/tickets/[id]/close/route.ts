import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// POST /api/soporte/tickets/[id]/close — user marks their ticket as solved
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { id } = await params

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true },
  })
  if (!ticket || ticket.userId !== session.user.id) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 })
  }
  if (ticket.status === "CLOSED") return NextResponse.json({ ok: true })

  await db.supportTicket.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date(), unreadByAdmin: false, unreadByUser: false },
  })
  return NextResponse.json({ ok: true })
}
