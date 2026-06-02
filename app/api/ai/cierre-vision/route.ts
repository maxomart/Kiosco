import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import OpenAI from "openai"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { hasFeature, AI_DAILY_QUOTA, AI_PER_MINUTE_LIMIT } from "@/lib/permissions"
import { getOpenAI, isOpenAIConfigured, DEFAULT_MODEL } from "@/lib/openai"
import type { Plan } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Each image arrives as a data URL already downscaled client-side (max 1600px,
// JPEG q0.85) → ~200-600KB → ~300-800KB base64. Cap at 8MB/image and 5 images
// to bound the request payload and the token cost of the vision call.
const MAX_IMAGE_CHARS = 8_000_000
const dataUrlSchema = z.string().startsWith("data:image/").max(MAX_IMAGE_CHARS)
const bodySchema = z.object({
  images: z.array(dataUrlSchema).min(1).max(5),
})

// In-memory per-tenant per-minute limiter — same approach as /api/ai/chat.
// Stops a tight loop / stuck UI from burning the daily quota in seconds.
const minuteWindow: Map<string, number[]> = new Map()
function checkPerMinuteLimit(tenantId: string): boolean {
  const now = Date.now()
  const cutoff = now - 60_000
  const arr = (minuteWindow.get(tenantId) ?? []).filter((t) => t > cutoff)
  if (arr.length >= AI_PER_MINUTE_LIMIT) {
    minuteWindow.set(tenantId, arr)
    return false
  }
  arr.push(now)
  minuteWindow.set(tenantId, arr)
  return true
}

const SYS_PROMPT =
  "Sos un asistente que extrae datos del cierre de caja de una cafeteria en Argentina a partir de imagenes. Te pueden pasar: (1) una foto de la pantalla de un sistema POS (por ejemplo 'MrService') con totales de ventas, y/o (2) una foto de una planilla de cierre escrita a mano. Tu tarea es leer los numeros y devolver SOLO un objeto JSON valido (sin texto extra) con los campos indicados. Reglas estrictas: los montos van como numeros enteros, sin simbolo $ ni separadores de miles (ej: '560.300' o '$ 560.300' => 560300; si hay coma decimal usala como punto). Si un dato no aparece o no estas seguro, poné null para los campos sueltos y [] para las listas. No inventes ningun valor: si no lo ves, va null."

const USER_PROMPT =
  "Lee la(s) imagen(es) y devolve un JSON con esta forma exacta (todos los campos son opcionales, poné null o [] si no aparece):\n{\n \"fecha\": \"YYYY-MM-DD o null\",\n \"numeroZ\": \"texto o null (Numero Z del reporte)\",\n \"ticketsZ\": \"entero o null (cant. de tickets fiscales; en el POS suele figurar como 'Fac. B FIS (52)' => 52)\",\n \"ticketsAB\": \"entero o null (cant. de Facturas A/B no fiscales; POS 'Factura B (19)' => 19)\",\n \"importeZ\": \"numero o null (Importe total del Z o 'Fac. B FIS', el monto FISCAL)\",\n \"facturasAB\": \"numero o null ('Facturas A y B' o 'Factura B', el monto NO fiscal)\",\n \"salonMonto\": \"numero o null\", \"salonCub\": \"entero o null (ventas de Salon y cubiertos)\",\n \"takeMonto\": \"numero o null\", \"takeCub\": \"entero o null (Take away)\",\n \"otroMonto\": \"numero o null\", \"otroCub\": \"entero o null\",\n \"saldoAnterior\": \"numero o null ('Saldo de dia anterior')\",\n \"efectivo\": [{\"concepto\":\"ej Caja o Bolsa\",\"monto\":0}],\n \"gastos\": [{\"concepto\":\"texto\",\"monto\":0}],\n \"retiros\": [{\"concepto\":\"ej Tarjeta/TD o Mercado Pago/MP\",\"monto\":0}],\n \"propinas\": [{\"concepto\":\"texto o null\",\"monto\":0,\"personas\":0}]\n}\nNotas: 'Salon' y 'Take away' a veces traen los cubiertos entre parentesis, ej 'Salon 567800 (54)' => salonMonto 567800, salonCub 54. En 'Retiros' suelen estar los pagos virtuales (Tarjeta/TD, Mercado Pago/MP). En 'Gastos' van nombres de proveedores o personas con su monto. Devolve unicamente el JSON."

async function getDailyUsage(tenantId: string): Promise<number> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return db.auditLog
    .count({
      where: {
        action: "AI_CIERRE_VISION",
        createdAt: { gte: start },
        newValue: { contains: tenantId },
      },
    })
    .catch(() => 0)
}

async function recordUsage(tenantId: string, userId: string) {
  await db.auditLog
    .create({
      data: {
        userId,
        action: "AI_CIERRE_VISION",
        entity: "CierreVision",
        newValue: tenantId,
      },
    })
    .catch(() => {})
}

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  // Plan gate — vision is an AI feature; same gate as the chat assistant so a
  // single tenant can't drain the shared OpenAI key.
  const sub = await db.subscription.findUnique({
    where: { tenantId: tenantId! },
    select: { plan: true },
  })
  const plan = (sub?.plan as Plan) ?? "STARTER"

  if (!hasFeature(plan, "feature:ai_assistant")) {
    return NextResponse.json(
      { error: "Leer fotos con IA no está incluido en tu plan. Actualizá a Profesional para activarlo." },
      { status: 402 }
    )
  }

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "La IA no está configurada. El dueño debe agregar OPENAI_API_KEY en Railway." },
      { status: 503 }
    )
  }

  // Daily quota — soft cap per plan
  const usage = await getDailyUsage(tenantId!)
  const quota = AI_DAILY_QUOTA[plan]
  if (usage >= quota) {
    return NextResponse.json(
      {
        error: `Llegaste al límite diario de IA de tu plan ${plan} (${quota}). Volvé mañana o subí de plan.`,
        quotaReached: true,
      },
      { status: 429 }
    )
  }

  // Per-minute ceiling
  if (!checkPerMinuteLimit(tenantId!)) {
    return NextResponse.json(
      { error: "Demasiados intentos muy rápido. Esperá unos segundos y volvé a intentar." },
      { status: 429 }
    )
  }

  // Body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const openai = getOpenAI()
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: USER_PROMPT },
      ...parsed.data.images.map(
        (url) => ({ type: "image_url" as const, image_url: { url } })
      ),
    ]

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0,
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYS_PROMPT },
        { role: "user", content },
      ],
    })

    // Record usage AFTER a successful call (don't penalize failures).
    await recordUsage(tenantId!, session.user.id!)

    const text = response.choices[0]?.message?.content ?? "{}"
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { error: "La IA devolvió una respuesta que no pude leer. Probá sacando la foto más nítida." },
        { status: 502 }
      )
    }

    return NextResponse.json({ data, quota, used: usage + 1 })
  } catch (err: any) {
    console.error("[POST /api/ai/cierre-vision] openai error", err?.message)
    let userError = err?.message ?? "Error de la IA"
    if (err?.status === 401) {
      userError = "La OPENAI_API_KEY es inválida. Verificá la key en Railway."
    } else if (err?.status === 429) {
      userError = "OpenAI está rate-limiteando. Probá de nuevo en unos segundos."
    } else if (err?.status === 402 || err?.code === "insufficient_quota") {
      userError = "Te quedaste sin crédito en OpenAI. Recargá saldo en platform.openai.com/billing."
    }
    return NextResponse.json({ error: userError }, { status: 500 })
  }
}
