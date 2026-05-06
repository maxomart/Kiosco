import { NextRequest, NextResponse } from "next/server"
import { getOpenAI } from "@/lib/openai"
import { getSessionTenant } from "@/lib/tenant"
import { can } from "@/lib/permissions"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Importar productos desde una FOTO — el kiosquero saca foto del ticket
 * de mayorista, de la lista en papel, o de la góndola y la IA detecta
 * los productos con sus precios.
 *
 * Pipeline:
 *   1. Recibe imagen como base64 o multipart/form-data.
 *   2. Llama a GPT-4o-mini con vision (input: imagen + prompt JSON-strict).
 *   3. Devuelve un array de filas { name, price, quantity?, costPrice? }
 *      con la misma forma que produciría el preview de CSV — así el flujo
 *      del ImportModal puede reutilizar las pantallas de validación y
 *      commit que ya existen.
 *
 * Cuesta ~$0.01-0.02 por foto (gpt-4o-mini con imagen ~1MP). Lo gateamos
 * a planes pagos y limitamos tamaño / cantidad por día desde el client.
 */

const SYSTEM_PROMPT = `Sos un asistente que extrae productos de una imagen para un kiosco/almacén argentino.

La imagen puede ser:
- Un TICKET de mayorista (Maxiconsumo, Vital, Diarco, Yaguar, etc.) con productos, cantidades y precios
- Una LISTA escrita a mano o impresa con productos y precios
- Una FOTO de góndola con productos visibles

Tu tarea: devolver un array JSON de productos detectados con la siguiente forma:

{
  "items": [
    {
      "name": "nombre del producto tal como aparece, en castellano argentino",
      "price": <número en pesos argentinos, sin símbolo>,
      "costPrice": <opcional — si la imagen es ticket de mayorista, es el costo unitario>,
      "quantity": <opcional — cantidad/unidades si aparece (ej: x12, x6)>,
      "barcode": <opcional — si en la imagen aparece código de barras legible>
    }
  ],
  "imageType": "ticket-mayorista" | "lista" | "gondola",
  "warning": "<mensaje si la imagen es de mala calidad / faltan datos>"
}

REGLAS:
- Si es ticket de mayorista: el price normalmente ES el costo (precio de compra). Ponelo en costPrice.
  El name dejalo como aparece, sin "abreviar" (ej: "COCA COLA 2.25L X12" → name: "Coca-Cola 2.25L", quantity: 12).
- Si es lista escrita: el price es el precio de venta (lo que cobra el kiosco). Ponelo en price.
- Normalizá el nombre a mayúscula inicial: "COCA COLA" → "Coca Cola".
- Si no podés leer un producto con seguridad, no lo incluyas (mejor menos productos correctos que muchos errados).
- Si la imagen está borrosa o cortada, agregá warning explicativo.
- price y costPrice DEBEN ser números (sin símbolos, sin puntos de miles, sin comas decimales — usá . si hay decimales).

Respondé SOLO el JSON, sin markdown ni texto adicional.`

interface ParsedItem {
  name: string
  price?: number
  costPrice?: number
  quantity?: number
  barcode?: string
}

export async function POST(req: NextRequest) {
  const { error, session } = await getSessionTenant()
  if (error) return error
  if (!can(session?.user?.role, "products:import")) {
    return NextResponse.json({ error: "Sin permisos para importar productos" }, { status: 403 })
  }

  let imageBase64: string | null = null
  const contentType = req.headers.get("content-type") ?? ""

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("image") as File | null
      if (!file) return NextResponse.json({ error: "Falta el campo 'image' en el form" }, { status: 400 })
      if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: "La imagen es demasiado grande (máx 8MB)." }, { status: 413 })
      }
      const buf = Buffer.from(await file.arrayBuffer())
      imageBase64 = `data:${file.type || "image/jpeg"};base64,${buf.toString("base64")}`
    } else {
      const body = await req.json()
      const raw = String(body?.image ?? "")
      if (!raw) return NextResponse.json({ error: "Falta 'image' (data URL base64) en el JSON" }, { status: 400 })
      // Si nos vino sin el prefijo data:..., asumimos JPEG.
      imageBase64 = raw.startsWith("data:") ? raw : `data:image/jpeg;base64,${raw}`
    }
  } catch (e: any) {
    return NextResponse.json({ error: "Error leyendo la imagen", detail: e?.message }, { status: 400 })
  }

  if (!imageBase64) {
    return NextResponse.json({ error: "Imagen no recibida" }, { status: 400 })
  }

  let openai
  try {
    openai = getOpenAI()
  } catch {
    return NextResponse.json({
      error: "El servicio de IA no está configurado. Contactá a soporte.",
    }, { status: 503 })
  }

  // Llamada a Vision. gpt-4o-mini soporta imágenes y es ~10x más barato
  // que gpt-4o full. Calidad suficiente para tickets y listas de kiosco.
  let raw: string = "{}"
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Analizá esta imagen y devolvé el JSON de productos." },
            { type: "image_url", image_url: { url: imageBase64, detail: "high" } as any },
          ] as any,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 4096,
    })
    raw = completion.choices[0]?.message?.content ?? "{}"
  } catch (err: any) {
    console.error("[importar/foto] OpenAI error", err?.message)
    return NextResponse.json({
      error: "La IA no pudo procesar la imagen. Probá con otra foto más clara.",
      detail: err?.message,
    }, { status: 502 })
  }

  let parsed: { items?: ParsedItem[]; imageType?: string; warning?: string }
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({
      error: "La IA devolvió un formato inesperado. Probá de nuevo o usá otra foto.",
    }, { status: 502 })
  }

  const items = Array.isArray(parsed.items) ? parsed.items : []

  // Sanitizamos cada item antes de devolver al cliente.
  const cleaned = items
    .map((it) => {
      const name = String(it.name ?? "").trim()
      if (!name) return null
      const out: any = { name }
      if (typeof it.price === "number" && it.price > 0) out.price = Math.round(it.price * 100) / 100
      if (typeof it.costPrice === "number" && it.costPrice > 0) out.costPrice = Math.round(it.costPrice * 100) / 100
      if (typeof it.quantity === "number" && it.quantity > 0) out.quantity = Math.floor(it.quantity)
      if (it.barcode && /^\d{8,14}$/.test(String(it.barcode))) out.barcode = String(it.barcode)
      return out
    })
    .filter((it): it is { name: string; price?: number; costPrice?: number; quantity?: number; barcode?: string } => !!it)

  return NextResponse.json({
    items: cleaned,
    imageType: parsed.imageType ?? "lista",
    warning: parsed.warning ?? null,
    count: cleaned.length,
  })
}
