import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { hasFeature, AI_DAILY_QUOTA } from "@/lib/permissions"
import { getOpenAI, isOpenAIConfigured, DEFAULT_MODEL } from "@/lib/openai"
import { buildBusinessContext, renderContextForPrompt } from "@/lib/ai-context"
import type { Plan } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
})

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
})

const SYSTEM_PROMPT = `Sos un asistente experto para dueños y empleados de comercios en Argentina (kioscos, almacenes, farmacias, verdulerías, mini-súper).

PERSONALIDAD:
- Hablás argentino natural (vos, viste, dale, ojo). Cordial, directo, sin floreos.
- Práctico: respuestas cortas, accionables. No expliques de más.
- Honesto: si no tenés datos suficientes, decilo. Nunca inventes números.

TUS HERRAMIENTAS:
- Te paso un snapshot del negocio (ventas, stock, top productos, caja). Usalo para responder con datos reales.
- Si el usuario pregunta algo que no está en el snapshot, sugerile dónde encontrarlo en el sistema.

QUÉ HACER:
- Detectar oportunidades: stock bajo de un producto que se vende mucho → "Reponé X, vendiste 12 esta semana".
- Avisar problemas: caja abierta hace muchas horas, productos sin stock, ticket promedio bajando.
- Recomendar acciones específicas: precios sugeridos, promociones, ajustes de stock mínimo.
- Responder preguntas sobre el negocio usando los datos que te paso.

QUÉ NO HACER:
- No mostrar el snapshot completo (es contexto interno, no para mostrar).
- No prometer features que no existen ("te mando un email" — no podés).
- No usar tablas markdown grandes; respuestas conversacionales y cortas.
- No usar emojis excesivos. Máximo 1-2 por respuesta si suman.

Si la pregunta es ambigua, hacé UNA pregunta de aclaración corta.`

async function getDailyUsage(tenantId: string): Promise<number> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return db.auditLog.count({
    where: {
      action: "AI_CHAT",
      createdAt: { gte: start },
      newValue: { contains: tenantId },
    },
  }).catch(() => 0)
}

async function recordUsage(tenantId: string, userId: string) {
  await db.auditLog.create({
    data: {
      userId,
      action: "AI_CHAT",
      entity: "ChatMessage",
      newValue: tenantId,
    },
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  // Plan check
  const sub = await db.subscription.findUnique({
    where: { tenantId: tenantId! },
    select: { plan: true },
  })
  const plan = (sub?.plan as Plan) ?? "FREE"

  if (!hasFeature(plan, "feature:ai_assistant")) {
    return NextResponse.json({ error: "El asistente IA no está incluido en tu plan." }, { status: 402 })
  }

  if (!isOpenAIConfigured()) {
    return NextResponse.json({
      error: "El asistente IA no está configurado. El dueño debe agregar OPENAI_API_KEY en Railway.",
    }, { status: 503 })
  }

  // Rate limit
  const usage = await getDailyUsage(tenantId!)
  const quota = AI_DAILY_QUOTA[plan]
  if (usage >= quota) {
    return NextResponse.json({
      error: `Llegaste al límite diario de tu plan ${plan} (${quota} mensajes). Volvé mañana o suscribite a un plan superior.`,
      quotaReached: true,
      quota,
      used: usage,
    }, { status: 429 })
  }

  // Body
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  // Build live business context
  let contextText: string
  try {
    const ctx = await buildBusinessContext(tenantId!, plan)
    contextText = renderContextForPrompt(ctx)
  } catch (err) {
    console.error("[POST /api/ai/chat] context build failed", err)
    contextText = "(No se pudo cargar el snapshot del negocio. Respondé igual con la pregunta del usuario.)"
  }

  const fullSystem = `${SYSTEM_PROMPT}\n\n## SNAPSHOT ACTUAL DEL NEGOCIO\n${contextText}`

  try {
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        { role: "system", content: fullSystem },
        ...parsed.data.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    })

    // Record usage AFTER successful call (don't penalize failures)
    await recordUsage(tenantId!, session.user.id!)

    const text = response.choices[0]?.message?.content ?? ""

    return NextResponse.json({
      reply: text,
      usage: {
        input: response.usage?.prompt_tokens ?? 0,
        output: response.usage?.completion_tokens ?? 0,
      },
      quota,
      used: usage + 1,
    })
  } catch (err: any) {
    console.error("[POST /api/ai/chat] openai error", err?.message)
    // Surface a friendlier message for common cases
    let userError = err?.message ?? "Error del asistente IA"
    if (err?.status === 401) {
      userError = "La OPENAI_API_KEY es inválida. Verificá la key en Railway."
    } else if (err?.status === 429) {
      userError = "OpenAI te está rate-limiteando. Probá de nuevo en unos segundos o revisá tu cuota."
    } else if (err?.status === 402 || err?.code === "insufficient_quota") {
      userError = "Te quedaste sin crédito en OpenAI. Recargá saldo en platform.openai.com/billing."
    }
    return NextResponse.json({ error: userError }, { status: 500 })
  }
}
