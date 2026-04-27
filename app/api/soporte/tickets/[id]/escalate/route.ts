import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"

// POST /api/soporte/tickets/[id]/escalate
// Manually flip a ticket to ESCALATED. Triggered by the user's "Hablar
// con Joaco" button. Sends an email to the admin so they don't have to
// poll the inbox.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { id } = await params

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 5 },
    },
  })
  if (!ticket || ticket.userId !== session.user.id) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 })
  }
  if (ticket.status === "CLOSED") {
    return NextResponse.json({ error: "Ticket cerrado" }, { status: 400 })
  }
  if (ticket.status === "ESCALATED") {
    return NextResponse.json({ ok: true, alreadyEscalated: true })
  }

  await db.$transaction([
    db.supportTicket.update({
      where: { id },
      data: {
        status: "ESCALATED",
        escalatedAt: new Date(),
        unreadByAdmin: true,
        unreadByUser: false,
        lastMessageAt: new Date(),
      },
    }),
    db.supportMessage.create({
      data: {
        ticketId: id,
        role: "ai",
        content: "Te paso con Joaco. Te respondemos en horario comercial argentino — vas a ver la respuesta acá mismo.",
      },
    }),
  ])

  // Best-effort email to admin
  const adminEmail = process.env.SUPERADMIN_EMAIL ?? process.env.EMAIL_REPLY_TO
  if (adminEmail) {
    const firstUserMessage =
      ticket.messages.find((m) => m.role === "user")?.content ?? "(sin mensaje)"
    await sendEmail({
      to: adminEmail,
      subject: `[Soporte] ${ticket.subject.replace(/[\r\n]+/g, " ").slice(0, 200)} — pidió hablar con humano`,
      html: `<div style="font-family:-apple-system;max-width:520px;margin:0 auto;padding:24px;">
        <p style="color:#6b7280;text-transform:uppercase;font-size:11px;font-weight:600;">soporte · escalado por usuario</p>
        <h2 style="margin:8px 0;color:#111827;">${escapeHtml(ticket.subject)}</h2>
        <p style="color:#4b5563;font-size:14px;">${escapeHtml(session.user.name)} (${escapeHtml(session.user.email)}) · plan ${ticket.planSnapshot ?? "FREE"}</p>
        <div style="background:#f3f4f6;border-radius:10px;padding:14px;font-size:14px;color:#111827;white-space:pre-wrap;margin-top:12px;">${escapeHtml(firstUserMessage)}</div>
        <p style="margin-top:16px;font-size:13px;"><a href="${process.env.NEXTAUTH_URL ?? ""}/admin/soporte/${id}" style="color:#2563eb;">Responder en /admin/soporte</a></p>
      </div>`,
      text: `Ticket escalado por ${session.user.email}: ${ticket.subject}\nResponder en /admin/soporte/${id}`,
    })
  }

  return NextResponse.json({ ok: true })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
