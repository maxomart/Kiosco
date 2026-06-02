import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import OpenAI from "openai"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { hasFeature, AI_DAILY_QUOTA, AI_PER_MINUTE_LIMIT } from "@/lib/permissions"
import { getOpenAI, isOpenAIConfigured } from "@/lib/openai"
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

// gpt-4o (no -mini) para esta ruta: lee mucho mejor la letra manuscrita y los
// dígitos en fotos de planillas/tickets que el mini. Cuesta ~10x más por llamada
// (igual son centavos), pero es una función de plata y la precisión importa.
// El chat sigue en DEFAULT_MODEL (mini); este override es solo para visión.
const VISION_MODEL = "gpt-4o"

const SYS_PROMPT = `Sos un asistente que extrae datos del cierre de caja de una cafetería en Argentina a partir de imágenes, para autocompletar un formulario. Te pueden pasar varias imágenes juntas: (1) la pantalla de un POS (ej "MrService") con las ventas; (2) tickets de tarjetas (ej Getnet/Posnet) o de Mercado Pago; (3) una planilla de cierre escrita a mano. Combiná TODAS las imágenes en un solo JSON. Reglas estrictas de números: van como enteros, sin símbolo $ ni separadores de miles ("266.800" o "$ 266.800" => 266800; si hay coma decimal usala como punto: "1.234,50" => 1234.5). Si un dato no aparece o no lo ves con seguridad, poné null para los campos sueltos y [] para las listas. NUNCA inventes un número: si no lo ves claro, va null. Devolvé SOLO el objeto JSON, sin ningún texto adicional.`

const USER_PROMPT = `Leé la(s) imagen(es) y devolvé un JSON con esta forma exacta (todos los campos son opcionales: null o [] si no aparece):
{
 "fecha": "YYYY-MM-DD o null",
 "numeroZ": "texto o null (Número de reporte Z)",
 "ticketsZ": "entero o null (cant. de tickets FISCALES; en el POS figura como 'Fac. B FIS (25)' => 25)",
 "ticketsAB": "entero o null (cant. de Facturas A/B NO fiscales; POS 'Factura B (9)' => 9)",
 "importeZ": "número o null (monto FISCAL: 'Fac. B FIS' del POS, o 'Z' en la planilla a mano)",
 "facturasAB": "número o null (monto NO fiscal: 'Factura B' del POS, o 'AyB' en la planilla a mano)",
 "salonMonto": "número o null", "salonCub": "entero o null (ventas de Salón y sus cubiertos)",
 "takeMonto": "número o null", "takeCub": "entero o null (Take away)",
 "otroMonto": "número o null", "otroCub": "entero o null",
 "saldoAnterior": "número o null (saldo del día ANTERIOR; en la planilla 'SDA')",
 "efectivo": [{"concepto":"ej Caja o Bolsa","monto":0}],
 "gastos": [{"concepto":"texto","monto":0}],
 "retiros": [{"concepto":"ej Tarjeta/TD o Mercado Pago/MP","monto":0}],
 "propinas": [{"concepto":"texto o null","monto":0,"personas":0}]
}

Diccionario de la planilla escrita a mano (abreviaturas de esta cafetería):
- Z = importe FISCAL => importeZ
- AyB = Facturas A y B, NO fiscal (suele ser efectivo) => facturasAB
- SD = "Saldo del día" = el efectivo CONTADO en caja al cerrar => va en efectivo, ej {"concepto":"Caja","monto":SD}
- TG = "Total de gastos" => si hay detalle cargá cada gasto en gastos[]; si solo está el total, gastos: [{"concepto":"Gastos","monto":TG}]
- TR = "Total de retiros" = plata que salió de la caja (tarjetas TD/Getnet, Mercado Pago MP, y a veces un retiro de efectivo del dueño/encargado) => cargá cada uno en retiros[]: {"concepto":"Tarjeta (TD)","monto":...}, {"concepto":"Mercado Pago (MP)","monto":...}, {"concepto":"Retiro efectivo","monto":...}
- SDA = "Saldo del día anterior" => saldoAnterior

NO pongas estos en ningún campo: son totales que la app recalcula sola (solo están en la planilla para chequear la cuenta): ET ("Egresos totales" = TG + TR), ST ("Suma total" = ET + SD), T ("Total" = ST − SDA), DF ("Diferencia" = T − AyB − Z).

Notas finales:
- 'Salón' y 'Take away' a veces traen los cubiertos entre paréntesis: 'Salón 251100 (26)' => salonMonto 251100, salonCub 26.
- En los tickets, Getnet/Posnet/Visa/débito => un retiro "Tarjeta"; Mercado Pago => un retiro "Mercado Pago".
- Para las VENTAS (Z, Factura B, Salón, Take away) priorizá lo que muestre el POS; el efectivo, los gastos y el saldo anterior salen de la planilla a mano.
Devolvé únicamente el JSON.`

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
      model: VISION_MODEL,
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
