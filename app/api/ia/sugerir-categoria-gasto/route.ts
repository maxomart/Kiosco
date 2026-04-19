import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { auth } from "@/lib/auth"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /api/ia/sugerir-categoria-gasto
// Recibe descripción y categorías disponibles, sugiere la mejor
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  try {
    const { description, availableCategories } = await req.json()

    if (!description?.trim()) {
      return NextResponse.json({ error: "Falta descripción" }, { status: 400 })
    }

    const prompt = `Estás ayudando a categorizar un gasto de un kiosco argentino.

Descripción del gasto: "${description}"

Categorías disponibles: ${JSON.stringify(availableCategories ?? [])}

Tu tarea:
1. Si alguna categoría existente encaja bien, devolvé su nombre exacto.
2. Si ninguna encaja, sugerí el nombre de una nueva categoría apropiada (corta, en mayúscula inicial, en español).

Respondé SOLO con JSON válido, sin texto adicional ni markdown:
{"category": "NombreCategoria", "isNew": true|false}`

    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 200,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Sin respuesta" }, { status: 500 })
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: "Respuesta inválida" }, { status: 500 })

    const { category, isNew } = JSON.parse(jsonMatch[0])
    return NextResponse.json({ category, isNew })
  } catch (err) {
    console.error("[/api/ia/sugerir-categoria-gasto]", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
