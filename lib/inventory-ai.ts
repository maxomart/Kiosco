import { getOpenAI } from "@/lib/openai"
import { similarity } from "@/lib/fuzzy-match"
import { lookupKnownBrand } from "@/lib/known-brands-ar"

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

REGLAS CRÍTICAS SOBRE EL PROVEEDOR:
- SOLO devolvé un supplier si estás SEGURO de cuál es el fabricante oficial argentino actual.
- Si tenés la menor duda sobre el fabricante, devolvé supplier: null. Es PREFERIBLE null a equivocarse.
- NO asumas que una marca es del mismo fabricante que una marca parecida.
- Nombres de fabricantes argentinos válidos (completos):
  * "Coca-Cola Argentina" (Coca-Cola, Sprite, Fanta, Aquarius, Schweppes, Powerade, Dasani, Cepita, Ades)
  * "PepsiCo Argentina" (Pepsi, 7up, Mirinda, Gatorade, H2Oh, Paso de los Toros)
  * "Arcor" (Bon o Bon, Cofler, Sugus, Topline, Menthoplus, Bagley, Chocolinas, La Campagnola)
  * "Molinos Río de la Plata" (Matarazzo, Luchetti, Cruz de Malta, Don Vicente)
  * "Unilever Argentina" (Ayudín, Cif, Ala, Dove, Rexona, Axe, Sedal)
  * "Procter & Gamble" (Magistral, Ariel, Gillette, Pantene)
  * "Mastellone Hermanos" (La Serenísima, Yogurísimo, Casancrem)
  * "Mondelez Argentina" (Milka, Oreo, Beldent, Halls)
  * "Danone Argentina" (Villa del Sur, Villavicencio, Actimel, Activia)
  * "Cervecería y Maltería Quilmes" (Quilmes, Brahma, Stella Artois, Corona)
  * "Felfort" (Águila Felfort, Jorgelín)

REGLAS SOBRE LA CATEGORÍA:
- Usá categorías genéricas: "Bebidas", "Golosinas", "Galletitas", "Lácteos", "Snacks", "Limpieza", "Almacén", "Higiene", "Cigarrillos", "Panificados", "Congelados", "Fiambres".
- Si el producto es ambiguo, igual sugerí la categoría más probable.

CONFIDENCE:
- "high" → sabés con certeza (producto reconocible con nombre comercial claro)
- "medium" → probable pero no 100% seguro
- "low" → adivinando, usar solo para categoría (dejá supplier: null)

Responde SOLO con JSON válido:
{
  "items": [
    {
      "productId": "id tal como vino",
      "category": "nombre de categoría" o null,
      "supplier": "nombre de fabricante ARGENTINO exacto" o null,
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

  // FIRST PASS: lookup curated dictionary of Argentine brands
  // Products matched here don't need to go through the AI (saves tokens +
  // is deterministic + more accurate for known brands like Aquarius/Coca)
  const dictHits = new Map<string, { category: string; supplier: string; confidence: "high" | "medium" }>()
  const needsAI: ProductToEnrich[] = []

  for (const p of products) {
    const hit = lookupKnownBrand(p.name)
    if (hit) {
      dictHits.set(p.id, {
        category: hit.category || "",
        supplier: hit.supplier,
        confidence: hit.confidence,
      })
    } else {
      needsAI.push(p)
    }
  }

  // SECOND PASS: only send unknown products to IA
  const BATCH_SIZE = 30
  const batches: ProductToEnrich[][] = []
  for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
    batches.push(needsAI.slice(i, i + BATCH_SIZE))
  }

  // Run batches in parallel with concurrency limit of 3
  const results: AIResponseItem[] = []
  if (batches.length > 0) {
    const CONCURRENCY = 3
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const slice = batches.slice(i, i + CONCURRENCY)
      const batchResults = await Promise.all(slice.map(callAIForBatch))
      for (const r of batchResults) results.push(...r)
    }
  }

  const byId = new Map(results.map(r => [r.productId, r]))

  // Normalize AI-returned values: strip whitespace, treat "null"/"-"/"" as null
  const normalize = (val: string | null | undefined): string | null => {
    if (!val) return null
    const trimmed = String(val).trim()
    if (!trimmed) return null
    const low = trimmed.toLowerCase()
    if (low === "null" || low === "none" || low === "n/a" || low === "-" || low === "undefined") return null
    return trimmed
  }

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
    // Priority 1: dictionary hit (deterministic, curated, highest accuracy)
    const dict = dictHits.get(p.id)
    if (dict) {
      return {
        productId: p.id,
        productName: p.name,
        categorySuggestedRaw: dict.category || null,
        supplierSuggestedRaw: dict.supplier || null,
        categoryMatch: matchOrNew(dict.category || null, existingCategories),
        supplierMatch: matchOrNew(dict.supplier || null, existingSuppliers),
        confidence: dict.confidence,
      }
    }

    // Priority 2: AI-suggested
    const aiResult = byId.get(p.id)
    const catRaw = normalize(aiResult?.category ?? null)
    const supRaw = normalize(aiResult?.supplier ?? null)

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
