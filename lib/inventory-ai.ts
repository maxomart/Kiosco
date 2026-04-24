import { getOpenAI } from "@/lib/openai"
import { similarity } from "@/lib/fuzzy-match"

export interface ProductToEnrich {
  id: string
  name: string
  categoryName?: string | null
  supplierName?: string | null
}

export interface EnrichSuggestion {
  productId: string
  productName: string
  // Raw IA suggestions (names)
  categorySuggestedRaw: string | null
  supplierSuggestedRaw: string | null
  // After fuzzy match against existing lists
  categoryMatch: {
    type: "existing" | "new" | "skip"
    id: string | null // existing category id if type==="existing"
    name: string      // final name to use
    score: number
  }
  supplierMatch: {
    type: "existing" | "new" | "skip"
    id: string | null
    name: string
    score: number
  }
  confidence: "high" | "medium" | "low"
}

const SYSTEM_PROMPT = `Sos un experto en productos de kioscos, almacenes y supermercados argentinos.
Tu tarea: para cada producto, sugerir la CATEGORÍA apropiada y el PROVEEDOR/FABRICANTE más probable.

Reglas:
- Usá categorías genéricas que agrupen productos similares: "Bebidas", "Golosinas", "Galletitas", "Lácteos", "Snacks", "Limpieza", "Almacén", "Higiene", "Cigarrillos", "Panificados", etc.
- Para el proveedor, usá el nombre del fabricante argentino conocido: Coca-Cola Argentina, Arcor, Molinos, Unilever, Mondelez, PepsiCo, Quilmes, Danone, Mastellone, Bagley, Terrabusi, Felfort, etc.
- Si el nombre del producto no te dice nada sobre el proveedor, poné supplier: null.
- Confidence: "high" si estás muy seguro, "medium" si es razonable, "low" si es una inferencia débil.

Responde SOLO con JSON válido:
{
  "items": [
    {
      "productId": "id tal como vino",
      "category": "nombre de categoría",
      "supplier": "nombre de proveedor" | null,
      "confidence": "high" | "medium" | "low"
    }
  ]
}`

interface AIResponseItem {
  productId: string
  category: string | null
  supplier: string | null
  confidence: "high" | "medium" | "low"
}

async function callAIForBatch(products: ProductToEnrich[]): Promise<AIResponseItem[]> {
  const openai = getOpenAI()
  const userMsg = `Analizá estos productos:\n${products.map(p => `- ${p.id}: ${p.name}`).join("\n")}`

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 4096,
  })

  const raw = response.choices[0]?.message?.content ?? "{}"
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.items)) return []
    return parsed.items as AIResponseItem[]
  } catch {
    return []
  }
}

/**
 * Analyze a list of products and suggest category + supplier for each.
 * Fuzzy-matches against existing categories/suppliers before suggesting "new".
 *
 * Processes in batches of 30 to avoid huge prompts.
 */
export async function suggestEnrichment(
  products: ProductToEnrich[],
  existingCategories: Array<{ id: string; name: string }>,
  existingSuppliers: Array<{ id: string; name: string }>
): Promise<EnrichSuggestion[]> {
  if (products.length === 0) return []

  const BATCH_SIZE = 30
  const batches: ProductToEnrich[][] = []
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    batches.push(products.slice(i, i + BATCH_SIZE))
  }

  // Run batches in parallel with concurrency limit of 3
  const results: AIResponseItem[] = []
  const CONCURRENCY = 3
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const slice = batches.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(slice.map(callAIForBatch))
    for (const r of batchResults) results.push(...r)
  }

  const byId = new Map(results.map(r => [r.productId, r]))

  // Helper to find best match in an existing list
  const matchOrNew = (raw: string | null, list: Array<{ id: string; name: string }>) => {
    if (!raw) return { type: "skip" as const, id: null, name: "", score: 0 }
    // Find best fuzzy match
    let bestScore = 0
    let bestItem: { id: string; name: string } | null = null
    for (const item of list) {
      const s = similarity(raw, item.name)
      if (s > bestScore) {
        bestScore = s
        bestItem = item
      }
    }
    // If strong match (>=0.75) reuse existing
    if (bestItem && bestScore >= 0.75) {
      return { type: "existing" as const, id: bestItem.id, name: bestItem.name, score: bestScore }
    }
    // Otherwise propose creating a new one
    return { type: "new" as const, id: null, name: raw.trim(), score: bestScore }
  }

  return products.map(p => {
    const aiResult = byId.get(p.id)
    const catRaw = aiResult?.category ?? null
    const supRaw = aiResult?.supplier ?? null

    return {
      productId: p.id,
      productName: p.name,
      categorySuggestedRaw: catRaw,
      supplierSuggestedRaw: supRaw,
      categoryMatch: matchOrNew(catRaw, existingCategories),
      supplierMatch: matchOrNew(supRaw, existingSuppliers),
      confidence: aiResult?.confidence ?? "low",
    }
  })
}
