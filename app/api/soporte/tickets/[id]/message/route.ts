import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { replyToSupport } from "@/lib/support-ai"
import { sendEmail } from "@/lib/email"
import type { Plan } from "@/lib/utils"

// POST /api/soporte/tickets/[id]/message
// Body: { content: string }
//
// Adds a user message. If the ticket is still in AI mode (not escalated
// or closed), the AI replies. If the ticket is ESCALATED or ANSWERED, we
// just store the message and flag unreadByAdmin so the admin sees the
// follow-up — no AI reply.
//
// Cap: max 5 AI messages per ticket. After that, force-escalate so the
// human takes over and we don't burn tokens on a loop.
const MAX_AI_REPLIES_PER_TICKET = 5

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { id } = await params

  let body: { content?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }
  const content = body.content?.trim().slice(0, 4000)
  if (!content || content.length < 2) {
    return NextResponse.json({ error: "Escribí un mensaje." }, { status: 400 })
  }

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
  })
  if (!ticket || ticket.userId !== session.user.id) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 })
  }
  if (ticket.status === "CLOSED") {
    return NextResponse.json(
      { error: "Este ticket ya está cerrado. Abrí uno nuevo." },
      { status: 400 },
    )
  }

  // Always store the user message first
  await db.supportMessage.create({
    data: {
      ticketId: id,
      role: "user",
      content,
      authorId: session.user.id,
    },
  })

  // If the ticket has been escalated to a human, just notify and bail —
  // admin will reply when they see it.
  if (ticket.status === "ESCALATED" || ticket.status === "ANSWERED") {
    await db.supportTicket.update({
      where: { id },
      data: {
        status: "ESCALATED",
        unreadByAdmin: true,
        unreadByUser: false,
        lastMessageAt: new Date(),
      },
    })
    return NextResponse.json({ ok: true, escalated: true, aiReply: null })
  }

  // Otherwise, ask the AI for the next reply.
  const aiRepliesSoFar = ticket.messages.filter((m) => m.role === "ai").length
  const forceEscalate = aiRepliesSoFar >= MAX_AI_REPLIES_PER_TICKET

  if (forceEscalate) {
    await db.supportTicket.update({
      where: { id },
      data: {
        status: "ESCALATED",
        escalatedAt: new Date(),
        unreadByAdmin: true,
        unreadByUser: true,
        lastMessageAt: new Date(),
      },
    })
    await db.supportMessage.create({
      data: {
        ticketId: id,
        role: "ai",
        content: "Mejor te paso con Joaco — él te resuelve esto directo.",
      },
    })
    // Tell the admin too, otherwise the cap escalation only shows up
    // as an unread flag in the inbox and could sit there for days.
    void notifyAdminOfEscalation({
      ticketId: id,
      subject: ticket.subject,
      userEmail: session.user.email,
      userName: session.user.name,
      reason: "Después de 5 idas y vueltas con la IA, escalado automáticamente. Revisá la conversación.",
      plan: (ticket.planSnapshot ?? "FREE") as Plan,
    })
    return NextResponse.json({
      ok: true,
      escalated: true,
      aiReply: "Mejor te paso con Joaco — él te resuelve esto directo.",
    })
  }

  // Build conversation history for the AI
  const history = ticket.messages.map((m) => ({
    role: m.role as "user" | "ai" | "admin",
    content: m.content,
  }))
  history.push({ role: "user", content })

  const plan = (ticket.planSnapshot ?? "FREE") as Plan
  const reply = await replyToSupport(
    { plan, subject: ticket.subject },
    history,
  )

  await db.$transaction([
    db.supportMessage.create({
      data: { ticketId: id, role: "ai", content: reply.content },
    }),
    db.supportTicket.update({
      where: { id },
      data: {
        status: reply.shouldEscalate ? "ESCALATED" : "AI_REPLIED",
        escalatedAt: reply.shouldEscalate ? new Date() : ticket.escalatedAt,
        unreadByAdmin: reply.shouldEscalate,
        unreadByUser: true,
        lastMessageAt: new Date(),
      },
    }),
  ])

  // Notify admin if the AI escalated mid-thread (we already do this on
  // the very first message in the create-ticket route).
  if (reply.shouldEscalate) {
    void notifyAdminOfEscalation({
      ticketId: id,
      subject: ticket.subject,
      userEmail: session.user.email,
      userName: session.user.name,
      reason: "La IA marcó esta consulta como fuera de su alcance.",
      plan,
    })
  }

  return NextResponse.json({
    ok: true,
    escalated: reply.shouldEscalate,
    aiReply: reply.content,
  })
}

async function notifyAdminOfEscalation(opts: {
  ticketId: string
  subject: string
  userEmail: string
  userName: string
  reason: string
  plan: Plan
}) {
  const adminEmail = process.env.SUPERADMIN_EMAIL ?? process.env.EMAIL_REPLY_TO
  if (!adminEmail) return
  const safeSubject = opts.subject.replace(/[\r\n]+/g, " ").slice(0, 200)
  await sendEmail({
    to: adminEmail,
    subject: `[Soporte] ${safeSubject} — escalado por IA (${opts.plan})`,
    html: `<div style="font-family:-apple-system;max-width:520px;margin:0 auto;padding:24px;">
      <p style="color:#6b7280;text-transform:uppercase;font-size:11px;font-weight:600;">soporte · escalado</p>
      <h2 style="margin:8px 0;color:#111827;">${escapeHtml(opts.subject)}</h2>
      <p style="color:#4b5563;font-size:14px;">${escapeHtml(opts.userName)} (${escapeHtml(opts.userEmail)}) · plan ${opts.plan}</p>
      <p style="color:#6b7280;font-size:13px;font-style:italic;margin-top:12px;">${escapeHtml(opts.reason)}</p>
      <p style="margin-top:16px;font-size:13px;"><a href="${process.env.NEXTAUTH_URL ?? ""}/admin/soporte/${opts.ticketId}" style="color:#2563eb;">Ver hilo en /admin/soporte</a></p>
    </div>`,
    text: `Ticket escalado por IA — ${opts.userEmail} (${opts.plan}).\n${opts.reason}\nVer en /admin/soporte/${opts.ticketId}`,
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
