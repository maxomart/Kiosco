import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { auth } from "@/lib/auth"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /api/ia/sugerir-precio
// Recibe nombre y costo del producto, sugiere precio de venta y categoría
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  try {
    const { name, costPrice, categories } = await req.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "Falta nombre del producto" }, { status: 400 })
    }

    const prompt = `Estás ayudando a fijar precios en un kiosco argentino en 2026.

Producto: "${name}"
Precio de costo: ${costPrice ? `$${costPrice} ARS` : "no especificado"}
Categorías existentes: ${JSON.stringify(categories ?? [])}

Tu tarea:
1. Sugerir un margen de ganancia razonable (entre 25% y 80% según el tipo de producto — golosinas y bebidas suelen tener 30-50%, productos de limpieza e higiene 40-60%, tabaco 15-25%, cargas y recargas 5-10%).
2. Sugerir la categoría más apropiada (usar existente si encaja, sino sugerir una nueva).
3. Dar una breve justificación del margen elegido.

Si no te dieron costo, igual sugerí margen y categoría basándote solo en el nombre.

Respondé SOLO con JSON válido, sin markdown ni texto extra:
{
  "profitPercent": 35,
  "suggestedSalePrice": 1200,
  "category": "Bebidas",
  "categoryIsNew": false,
  "reasoning": "Las bebidas gaseosas típicamente tienen 30-40% de margen en kioscos."
}`

    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 400,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Sin respuesta" }, { status: 500 })
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: "Respuesta inválida" }, { status: 500 })

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (err) {
    console.error("[/api/ia/sugerir-precio]", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
