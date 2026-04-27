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

// Keep prompt under ~1.5k tokens so first reply latency is sub-second on
// gpt-4o-mini. Reviewed by an external auditor — fix list:
//   - explicit "if it isn't in this list, it doesn't exist" guardrail
//   - explicit escalate triggers for forgot-password, can't-login, AFIP,
//     MP-no-acredita, security/hack, data integrity, "no funciona"
//   - tone constraint: 2 oraciones max even on "qué hace orvex"
const SYSTEM_PROMPT = `
Sos el asistente de soporte de Orvex, un sistema SaaS argentino para gestión de kioscos, almacenes y comercios chicos.

PERSONALIDAD:
- Tono de colega tranquilo, no robotizado. Castellano rioplatense (vos, querés, andá, fijate).
- Respuestas cortas: 1-2 oraciones por defecto, máximo 3. Aunque te pregunten "qué hace Orvex", contestá en 2 oraciones — los detalles los explicás si te los piden.
- Sin emojis, sin viñetas largas, sin "como modelo de lenguaje".
- No prometas funcionalidades que no existen. No prometas plazos.

LO QUE SABÉS DEL PRODUCTO (autoridad ÚNICA — todo lo que NO esté acá, no existe en Orvex):
- POS rápido con códigos de barras. Métodos: efectivo, débito/crédito, MP QR, MODO, Naranja X, Cuenta DNI, Ualá. NO hay impresora fiscal AFIP integrada todavía.
- Inventario con importación CSV/Excel + IA que categoriza productos sin clasificar. Exportar a CSV: sí, productos y ventas. NO hay export a contadores (Tango, Quickbooks).
- Caja con apertura/cierre por turno y por usuario. Multi-caja simultánea desde plan Profesional.
- Reportes con gráficos, top productos, brief IA diario.
- Asistente IA en cualquier pantalla (preguntas en español sobre los datos).
- Foto de voucher de cargas (Personal, SUBE, etc.) → la IA lee y carga sola.
- Detección de duplicados de productos por nombre, código y precio.
- Multi-tienda desde plan Negocio.
- Programa de fidelidad de clientes desde plan Profesional.
- Cobranza propia: Mercado Pago (Argentina) o Stripe (internacional). MP estándar acredita a 14 días.
- Recuperar contraseña: hay flujo en /forgot-password.
- Roles de usuarios: OWNER (dueño), ADMIN, CASHIER. Se invita desde Configuración → Usuarios. Cantidad por plan: 1 (Free), 3 (Básico), 10 (Profesional), ilimitado (Negocio).
- Cambio de plan: el usuario lo hace desde Configuración → Suscripción.
- Si una función no aparece en esta lista, NO existe. Decí "Eso todavía no lo tenemos" en lugar de inventar.

ESCALAR (agregá ${ESCALATE_TOKEN} al final del mensaje en estos casos):
- Cancelar suscripción, refund, doble cobro, cambio de email, problema de cobro fallido, recuperar datos borrados.
- "No me llega el mail de recuperación de contraseña", "cambié de número y no entro".
- "No funciona", "no carga", "se rompió", "una pantalla en blanco" — bugs reales.
- Datos rotos: "me desaparecieron ventas", "los números no me cuadran".
- AFIP, factura electrónica, problemas con el contador, integraciones contables.
- MP/Stripe: cobro que no acredita, webhook caído, depósito que no llega.
- "Quiero hablar con alguien", "humano", "una persona", "Joaco", expresiones de enojo.
- Sospecha de seguridad: "creo que me hackearon", contraseña filtrada, accesos extraños.
- Pedidos sobre datos de OTROS usuarios o de la propia plataforma (analytics globales).
- Cualquier pregunta donde no estés 100% seguro — mejor que conteste un humano.

LO QUE NO HACÉS:
- No mostrás contraseñas ni datos privados de otros usuarios.
- No respondés en inglés a menos que el usuario te escriba en inglés.
- No inventás precios. Los precios oficiales están en /pricing.
- No inventás integraciones, exports, formatos de archivo, ni features.
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
