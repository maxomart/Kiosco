/**
 * Support-bot helpers.
 *
 * A small wrapper around OpenAI tuned for first-line product support. The
 * model gets:
 *
 *   1. A system prompt that tells it (a) what Orvex is, (b) the conventions
 *      it should follow (brief, rioplatense Spanish, no emojis, no fake
 *      promises), and (c) the well-known answers we already have.
 *   2. The user's plan and tenant id, so it doesn't recommend features
 *      they don't have.
 *   3. The full conversation so far.
 *
 * If the model decides the question is out of scope (billing dispute,
 * data loss, bug report, anything custom), it includes the literal token
 * `[[ESCALATE]]` somewhere in its reply. The API caller strips that
 * before storing and uses it to flip the ticket into ESCALATED state.
 *
 * Falls back to a deterministic "te paso con un humano" message when
 * OPENAI_API_KEY is missing — better than a blank reply.
 */

import { getOpenAI, isOpenAIConfigured, DEFAULT_MODEL } from "@/lib/openai"
import type { Plan } from "@/lib/utils"

export const ESCALATE_TOKEN = "[[ESCALATE]]"

// Keep prompt under ~1k tokens so first reply latency is sub-second on
// gpt-4o-mini.
const SYSTEM_PROMPT = `
Sos el asistente de soporte de Orvex, un sistema SaaS argentino para gestión de kioscos, almacenes y comercios chicos.

PERSONALIDAD:
- Tono de colega tranquilo, no robotizado. Castellano rioplatense (vos, querés, andá, fijate).
- Respuestas cortas (1-3 oraciones) salvo que el usuario pida detalle.
- Sin emojis, sin viñetas largas, sin "como modelo de lenguaje".
- No prometas funcionalidades que no existen. No prometas plazos.

LO QUE SABÉS DEL PRODUCTO:
- POS rápido con códigos de barras, métodos: efectivo, débito/crédito, MP QR, MODO, Naranja X, Cuenta DNI, Ualá.
- Inventario con importación CSV/Excel + IA que categoriza productos sin clasificar.
- Caja con apertura/cierre por turno y por usuario.
- Reportes con gráficos, top productos, brief IA diario.
- Asistente IA en cualquier pantalla (preguntas en español sobre los datos).
- Foto de voucher de cargas (Personal, SUBE, etc.) → la IA lee y carga sola.
- Detección de duplicados de productos por nombre, código y precio.
- Multi-caja simultánea desde plan Profesional.
- Multi-tienda desde plan Negocio.
- Programa de fidelidad de clientes desde plan Profesional.
- Cobranza propia: Mercado Pago (Argentina) o Stripe (internacional). MP estándar acredita a 14 días.

LÍMITES (cuándo escalar):
- Si te preguntan algo de su cuenta específica que requiere actuar (cancelar suscripción, refund, cambio de email, problema de cobro fallido, recuperar datos borrados): respondé con una línea corta y agregá ${ESCALATE_TOKEN} al final del mensaje. Eso transfiere a un humano automáticamente.
- Si te dicen "quiero hablar con alguien", "humano", "una persona": agregá ${ESCALATE_TOKEN} sin pelearla.
- Si no tenés idea o el bug es claro (algo no carga, una pantalla rota): pedí los datos básicos y agregá ${ESCALATE_TOKEN}.

LO QUE NO HACÉS:
- No mostrás contraseñas ni datos privados de otros usuarios.
- No respondés en inglés a menos que el usuario te escriba en inglés.
- No inventás precios. Los precios oficiales están en /pricing.
`.trim()

export interface SupportContext {
  /** Plan del usuario (para no recomendar features que no tiene) */
  plan: Plan
  /** Subject del ticket — ayuda al modelo a centrarse */
  subject: string
}

export interface SupportTurn {
  role: "user" | "ai" | "admin"
  content: string
}

export interface SupportReply {
  /** Texto a guardar como mensaje del asistente (sin el token ESCALATE) */
  content: string
  /** Si true, el ticket debe pasar a ESCALATED automáticamente */
  shouldEscalate: boolean
  /** Modelo usado (para debug/audit) */
  model: string
}

/**
 * Genera la próxima respuesta del bot. La conversación se le pasa entera
 * (no resumida) — los tickets son cortos, no vale la pena el costo de
 * implementar memoria larga.
 */
export async function replyToSupport(
  context: SupportContext,
  history: SupportTurn[],
): Promise<SupportReply> {
  if (!isOpenAIConfigured()) {
    return {
      content:
        "Soporte por IA no configurado todavía. Te paso con Joaco — te respondemos por mail en horario comercial argentino.",
      shouldEscalate: true,
      model: "fallback",
    }
  }

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `Plan del usuario: ${context.plan}. Asunto: ${context.subject}`,
    },
    ...history.map((t) => ({
      // admin replies are folded into "assistant" so the model sees a
      // continuous conversation; user is "user".
      role: t.role === "user" ? ("user" as const) : ("assistant" as const),
      content: t.content,
    })),
  ]

  try {
    const client = getOpenAI()
    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      max_tokens: 240,
      temperature: 0.45,
    })
    const raw = completion.choices[0]?.message?.content?.trim() ?? ""
    const shouldEscalate = raw.includes(ESCALATE_TOKEN)
    const content = raw.replaceAll(ESCALATE_TOKEN, "").trim() ||
      "Hmm, no me sale una buena respuesta — te paso con Joaco."
    return { content, shouldEscalate, model: DEFAULT_MODEL }
  } catch (e: any) {
    console.error("[support-ai] OpenAI failed:", e?.message ?? e)
    return {
      content:
        "Tuve un problema procesando tu mensaje. Te paso con un humano para que te responda.",
      shouldEscalate: true,
      model: "error-fallback",
    }
  }
}
