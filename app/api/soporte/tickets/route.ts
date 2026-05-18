import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { replyToSupport } from "@/lib/support-ai"
import { sendEmail } from "@/lib/email"
import type { Plan } from "@/lib/utils"

// Planes que reciben prioridad alta en la cola de soporte.
const HIGH_PRIORITY_PLANS = new Set<Plan>(["PROFESSIONAL", "BUSINESS", "ENTERPRISE"])

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
// la conversación. Le avisa al admin por mail de TODO ticket nuevo
// (escalado o no) para que no se le pase ninguna consulta.
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

  // Prioridad: los planes pagos altos van como HIGH para que el admin
  // los vea primero en la bandeja.
  const priority = HIGH_PRIORITY_PLANS.has(plan) ? "HIGH" : "NORMAL"

  // Crear ticket + primer mensaje en una transacción
  const ticket = await db.$transaction(async (tx) => {
    const t = await tx.supportTicket.create({
      data: {
        tenantId: session.user.tenantId ?? null,
        userId: session.user.id,
        subject,
        status: "OPEN",
        priority,
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
          unreadByAdmin: true,
          unreadByUser: true,
          lastMessageAt: new Date(),
        },
      }),
    ])
  } catch (e) {
    console.error("[soporte/tickets] AI reply failed:", e)
  }

  // Mail al admin de TODO ticket nuevo. Si escaló, mail urgente; si la IA
  // contestó, mail informativo con lo que se respondió.
  void notifyAdminOfNewTicket({
    ticketId: ticket.id,
    subject,
    userEmail: session.user.email,
    userName: session.user.name,
    message,
    plan,
    priority,
    escalated,
    aiReply: aiContent,
  })

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

async function notifyAdminOfNewTicket(opts: {
  ticketId: string
  subject: string
  userEmail: string
  userName: string
  message: string
  plan: Plan
  priority: string
  escalated: boolean
  aiReply: string | null
}) {
  const adminEmail = process.env.SUPERADMIN_EMAIL ?? process.env.EMAIL_REPLY_TO
  if (!adminEmail) return

  const esPrioritario = opts.priority === "HIGH"
  // Etiqueta del asunto del mail según urgencia.
  const tag = opts.escalated
    ? "ESCALADO"
    : esPrioritario
      ? "PRIORITARIO"
      : "nuevo"
  const subject = `[Soporte · ${tag}] ${sanitizeHeader(opts.subject)} — ${opts.plan}`

  // Bloque con la respuesta de la IA (solo si la IA contestó y no escaló).
  const aiBlock =
    opts.aiReply && !opts.escalated
      ? `
      <p style="margin:16px 0 4px;color:#6b7280;font-size:12px;font-weight:600;">La IA ya respondió esto:</p>
      <div style="background:#eef2ff;border-radius:10px;padding:14px 16px;font-size:13px;color:#3730a3;line-height:1.5;white-space:pre-wrap;">
        ${escapeHtml(opts.aiReply)}
      </div>`
      : ""

  const estadoTxt = opts.escalated
    ? "El usuario necesita una respuesta humana."
    : "La IA ya contestó. Revisalo por si querés sumar algo."

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <p style="margin:0 0 4px;color:${opts.escalated ? "#dc2626" : "#6b7280"};text-transform:uppercase;font-size:11px;letter-spacing:0.05em;font-weight:600;">
        soporte · ${opts.escalated ? "escalado" : "nuevo ticket"}${esPrioritario ? " · prioritario" : ""}
      </p>
      <h2 style="margin:0 0 12px;font-size:18px;color:#111827;">${escapeHtml(opts.subject)}</h2>
      <p style="color:#4b5563;font-size:14px;line-height:1.55;margin:0 0 12px;">
        <strong>${escapeHtml(opts.userName)}</strong> (${escapeHtml(opts.userEmail)}) · plan <strong>${opts.plan}</strong>
      </p>
      <div style="background:#f3f4f6;border-radius:10px;padding:14px 16px;font-size:14px;color:#111827;line-height:1.5;white-space:pre-wrap;">
        ${escapeHtml(opts.message)}
      </div>
      ${aiBlock}
      <p style="margin:16px 0 4px;color:#6b7280;font-size:13px;">${estadoTxt}</p>
      <p style="margin-top:8px;font-size:13px;color:#6b7280;">
        Respondé desde <a href="${process.env.NEXTAUTH_URL ?? ""}/admin/soporte" style="color:#2563eb;">/admin/soporte</a>.
      </p>
    </div>`.trim()

  const textParts = [
    `Ticket ${tag} de ${opts.userEmail} (${opts.plan}):`,
    "",
    opts.message,
  ]
  if (aiBlock) textParts.push("", "La IA respondió:", opts.aiReply ?? "")
  textParts.push("", "Responder en /admin/soporte")

  await sendEmail({
    to: adminEmail,
    subject,
    html,
    text: textParts.join("\n"),
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
