import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"

// GET /api/admin/support/tickets/[id] — full thread + user info. Marks
// as read by admin.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { id } = await params
  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
  })
  if (!ticket) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  if (ticket.unreadByAdmin) {
    await db.supportTicket.update({
      where: { id },
      data: { unreadByAdmin: false },
    })
  }

  const user = await db.user.findUnique({
    where: { id: ticket.userId },
    select: { id: true, name: true, email: true, phone: true, tenant: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ ticket, user })
}

// POST /api/admin/support/tickets/[id]/reply
// Body: { content: string, close?: boolean }
//
// Admin replies. If `close` is true, also closes the ticket. Sends a
// notification email to the user with the reply.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { id } = await params

  let body: { content?: string; close?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }
  const content = body.content?.trim().slice(0, 4000)
  if (!content) return NextResponse.json({ error: "Escribí algo" }, { status: 400 })

  const ticket = await db.supportTicket.findUnique({
    where: { id },
  })
  if (!ticket) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await db.$transaction([
    db.supportMessage.create({
      data: {
        ticketId: id,
        role: "admin",
        content,
        authorId: session.user.id,
      },
    }),
    db.supportTicket.update({
      where: { id },
      data: {
        status: body.close ? "CLOSED" : "ANSWERED",
        closedAt: body.close ? new Date() : null,
        unreadByAdmin: false,
        unreadByUser: true,
        lastMessageAt: new Date(),
      },
    }),
  ])

  // Notify user
  const user = await db.user.findUnique({
    where: { id: ticket.userId },
    select: { email: true, name: true },
  })
  if (user?.email) {
    await sendEmail({
      to: user.email,
      // Strip CR/LF — header injection guard. ticket.subject is user-
      // controlled and filtered at write time, this is defense-in-depth.
      subject: `Te respondieron tu consulta — ${ticket.subject.replace(/[\r\n]+/g, " ").slice(0, 200)}`,
      html: `<div style="font-family:-apple-system;max-width:520px;margin:0 auto;padding:24px;">
        <p style="color:#6b7280;text-transform:uppercase;font-size:11px;font-weight:600;">soporte · respuesta nueva</p>
        <h2 style="margin:8px 0;color:#111827;">${escapeHtml(ticket.subject)}</h2>
        <div style="background:#f3f4f6;border-radius:10px;padding:14px;font-size:14px;color:#111827;white-space:pre-wrap;margin-top:12px;">${escapeHtml(content)}</div>
        <p style="margin-top:16px;font-size:13px;color:#6b7280;">Entrá a tu cuenta y hacé click en "Soporte" para ver el hilo completo.</p>
      </div>`,
      text: `Tu consulta "${ticket.subject}" recibió una respuesta:\n\n${content}\n\nEntrá a tu cuenta y hacé click en "Soporte" para ver el hilo completo.`,
    })
  }

  return NextResponse.json({ ok: true })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
