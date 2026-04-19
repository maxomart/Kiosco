import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { auth } from "@/lib/auth"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /api/ia/mapear-columnas
// Recibe headers y una fila de muestra, devuelve un mapping header → campo del sistema
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  try {
    const { headers, sample } = await req.json()

    if (!Array.isArray(headers) || headers.length === 0) {
      return NextResponse.json({ error: "Se requieren headers" }, { status: 400 })
    }

    const prompt = `Tenés los siguientes encabezados de un CSV para importar productos de un kiosco/negocio:

Encabezados: ${JSON.stringify(headers)}
Muestra de la primera fila: ${JSON.stringify(sample ?? {})}

Los campos disponibles del sistema son:
- name: nombre del producto (REQUERIDO)
- salePrice: precio de venta (REQUERIDO)
- costPrice: precio de costo o compra
- barcode: código de barras EAN/UPC
- sku: código SKU interno
- stock: cantidad en stock actual
- minStock: stock mínimo para alertar
- unit: unidad de medida (ej: "un", "kg", "lt", "caja")
- categoryName: nombre de la categoría o rubro

Tu tarea: mapear cada encabezado del CSV al campo del sistema más apropiado.
Si un encabezado no corresponde a ningún campo conocido, asignale null.
Considerá variantes en español, abreviaciones y nombres creativos de columnas.

Respondé ÚNICAMENTE con JSON válido, sin texto adicional ni markdown, en este formato exacto:
{"encabezado_original": "campo_sistema_o_null", ...}

Ejemplo de respuesta válida:
{"Producto": "name", "Precio": "salePrice", "Cód": "barcode", "Descripción": null}`

    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 500,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Sin respuesta del modelo" }, { status: 500 })
    }

    // Extraer JSON de la respuesta (por si viene con algo extra)
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Respuesta no parseable" }, { status: 500 })
    }

    const mapping = JSON.parse(jsonMatch[0])
    return NextResponse.json({ mapping })
  } catch (err) {
    console.error("[/api/ia/mapear-columnas]", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
