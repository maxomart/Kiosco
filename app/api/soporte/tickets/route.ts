import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { replyToSupport } from "@/lib/support-ai"
import { sendEmail } from "@/lib/email"
import type { Plan } from "@/lib/utils"

// GET /api/soporte/tickets — lista de tickets del usuario actual
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const tickets = await db.supportTicket.findMany({
    where: { userId: session.user.id },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: {
      id: true,
      subject: true,
      status: true,
      lastMessageAt: true,
      unreadByUser: true,
      createdAt: true,
    },
  })
  return NextResponse.json({ tickets })
}

// POST /api/soporte/tickets
// Body: { subject: string, message: string }
//
// Crea un ticket, guarda el primer mensaje del usuario, e inmediatamente
// le pega a la IA para tener una respuesta lista cuando el usuario abra
// la conversación. Si la IA decide escalar (token ESCALATE en su salida),
// el ticket nace ESCALATED y le mandamos un mail al admin.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  let body: { subject?: string; message?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }
  // Strip CR/LF from subject — it ends up in email Subject: headers and
  // line breaks there enable header injection. Same trim/slice as before.
  const subject = body.subject
    ?.replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 120)
  const message = body.message?.trim().slice(0, 4000)
  if (!subject || subject.length < 3) {
    return NextResponse.json({ error: "El asunto es muy corto." }, { status: 400 })
  }
  if (!message || message.length < 3) {
    return NextResponse.json({ error: "Escribí tu consulta." }, { status: 400 })
  }

  // Plan snapshot — best-effort. Si no hay subscription, FREE.
  let plan: Plan = "FREE"
  if (session.user.tenantId) {
    try {
      const sub = await db.subscription.findUnique({
        where: { tenantId: session.user.tenantId },
        select: { plan: true },
      })
      if (sub?.plan) plan = sub.plan as Plan
    } catch {
      /* fallthrough — usamos FREE */
    }
  }

  // Crear ticket + primer mensaje en una transacción
  const ticket = await db.$transaction(async (tx) => {
    const t = await tx.supportTicket.create({
      data: {
        tenantId: session.user.tenantId ?? null,
        userId: session.user.id,
        subject,
        status: "OPEN",
        planSnapshot: plan,
      },
    })
    await tx.supportMessage.create({
      data: {
        ticketId: t.id,
        role: "user",
        content: message,
        authorId: session.user.id,
      },
    })
    return t
  })

  // Pegarle a la IA para la primera respuesta. Best-effort — si falla
  // dejamos el ticket en OPEN para que el admin lo agarre.
  let aiContent: string | null = null
  let escalated = false
  try {
    const reply = await replyToSupport(
      { plan, subject },
      [{ role: "user", content: message }],
    )
    aiContent = reply.content
    escalated = reply.shouldEscalate

    await db.$transaction([
      db.supportMessage.create({
        data: {
          ticketId: ticket.id,
          role: "ai",
          content: aiContent,
          authorId: null,
        },
      }),
      db.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: escalated ? "ESCALATED" : "AI_REPLIED",
          escalatedAt: escalated ? new Date() : null,
          unreadByAdmin: escalated,
          unreadByUser: true,
          lastMessageAt: new Date(),
        },
      }),
    ])
  } catch (e) {
    console.error("[soporte/tickets] AI reply failed:", e)
  }

  // Mail al admin si escaló
  if (escalated) {
    void notifyAdminOfEscalation({
      ticketId: ticket.id,
      subject,
      userEmail: session.user.email,
      userName: session.user.name,
      message,
      plan,
    })
  }

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      subject,
      status: escalated ? "ESCALATED" : aiContent ? "AI_REPLIED" : "OPEN",
    },
    aiReply: aiContent,
    escalated,
  })
}

async function notifyAdminOfEscalation(opts: {
  ticketId: string
  subject: string
  userEmail: string
  userName: string
  message: string
  plan: Plan
}) {
  const adminEmail = process.env.SUPERADMIN_EMAIL ?? process.env.EMAIL_REPLY_TO
  if (!adminEmail) return
  // Defensive — subject is already CR/LF-stripped at write time, but if
  // a future migration ever loads pre-existing rows that aren't, this
  // guarantees no header injection.
  const subject = `[Soporte] ${sanitizeHeader(opts.subject)} — ${opts.plan}`
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <p style="margin:0 0 4px;color:#6b7280;text-transform:uppercase;font-size:11px;letter-spacing:0.05em;font-weight:600;">soporte · escalado</p>
      <h2 style="margin:0 0 12px;font-size:18px;color:#111827;">${escapeHtml(opts.subject)}</h2>
      <p style="color:#4b5563;font-size:14px;line-height:1.55;margin:0 0 12px;">
        <strong>${escapeHtml(opts.userName)}</strong> (${escapeHtml(opts.userEmail)}) · plan <strong>${opts.plan}</strong>
      </p>
      <div style="background:#f3f4f6;border-radius:10px;padding:14px 16px;font-size:14px;color:#111827;line-height:1.5;white-space:pre-wrap;">
        ${escapeHtml(opts.message)}
      </div>
      <p style="margin-top:18px;font-size:13px;color:#6b7280;">
        Respondé desde <a href="${process.env.NEXTAUTH_URL ?? ""}/admin/soporte/${opts.ticketId}" style="color:#2563eb;">/admin/soporte</a>.
      </p>
    </div>`.trim()
  await sendEmail({
    to: adminEmail,
    subject,
    html,
    text: `Ticket escalado de ${opts.userEmail} (${opts.plan}):\n\n${opts.message}\n\nResponder en /admin/soporte/${opts.ticketId}`,
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function sanitizeHeader(s: string): string {
  return s.replace(/[\r\n]+/g, " ").slice(0, 200)
}
