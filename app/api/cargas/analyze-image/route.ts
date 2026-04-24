import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can, hasFeature } from "@/lib/permissions"
import type { Plan } from "@/lib/utils"
import { getOpenAI } from "@/lib/openai"
import { matchProduct, type ProductCandidate } from "@/lib/fuzzy-match"

/**
 * Parse Argentine number format.
 * Handles:
 *   "$ 1.250,00" → 1250
 *   "$1.250"     → 1250  (miles sin decimales)
 *   "900,00"     → 900
 *   "1250"       → 1250
 *   "30.000,00"  → 30000
 *   1250 (number) → 1250
 */
function parseARS(raw: unknown): number {
  if (typeof raw === "number") return isFinite(raw) ? raw : 0
  if (!raw) return 0
  let str = String(raw).trim()
  // Strip currency symbols and spaces
  str = str.replace(/[$\s]/g, "")
  if (!str) return 0

  // If comma is present, it's Argentine format: remove thousand dots, replace comma with dot
  if (str.includes(",")) {
    const normalized = str.replace(/\./g, "").replace(",", ".")
    const n = parseFloat(normalized)
    return isFinite(n) ? n : 0
  }

  // Only dots: could be argentine thousand separator OR english decimal
  const parts = str.split(".")
  if (parts.length === 1) {
    const n = parseFloat(str)
    return isFinite(n) ? n : 0
  }

  // If any dot-separated segment after the first has exactly 3 digits, treat as thousands
  // e.g. "1.250" or "30.000" or "1.250.000"
  const isThousandsFormat = parts.slice(1).every((seg) => seg.length === 3)
  if (isThousandsFormat) {
    const n = parseFloat(str.replace(/\./g, ""))
    return isFinite(n) ? n : 0
  }

  // Otherwise assume english decimal "1250.50"
  const n = parseFloat(str)
  return isFinite(n) ? n : 0
}

async function getPlan(tenantId: string): Promise<Plan> {
  const sub = await db.subscription.findUnique({
    where: { tenantId },
    select: { plan: true },
  })
  return (sub?.plan as Plan) ?? "FREE"
}

const PROMPT = `Sos un asistente que lee remitos, facturas o listas de proveedores argentinos (bebidas, kioscos, almacenes).

Tu tarea: extraer cada línea de producto de la imagen y detectar si la factura tiene IVA.

Devolvé SOLO un JSON válido con esta estructura exacta:
{
  "supplierHint": "Nombre del proveedor si aparece visible (logo o encabezado), o null",
  "invoiceType": "A" | "B" | "C" | "M" | "X" | null (según la letra visible en el recuadro),
  "subtotalRaw": "Base imponible o subtotal sin IVA como aparece (ej: '$ 277.800,00'), o null",
  "taxPercent": número del porcentaje de IVA (ej: 21, 10.5), o null si no hay IVA,
  "taxAmountRaw": "Monto total del IVA como aparece (ej: '$ 58.338,00'), o null",
  "totalRaw": "Total final de la factura (con IVA si corresponde) como aparece (ej: '$ 336.138,00'), o null",
  "items": [
    {
      "rawName": "nombre del producto tal como aparece",
      "quantity": número entero de cantidad (default 1 si no aparece),
      "unitCostRaw": "precio unitario EXACTAMENTE como aparece en la imagen (ej: '$ 1.250,00')",
      "totalCostRaw": "precio total de la línea EXACTAMENTE como aparece (ej: '$ 30.000,00')",
      "unit": "unidad|pack|caja|kg|lt" o null
    }
  ]
}

REGLAS CRÍTICAS SOBRE NÚMEROS:
- En Argentina el punto (.) separa MILES y la coma (,) separa DECIMALES.
- "$1.250,00" = 1250 pesos, NO 1.25 dólares.
- "$30.000,00" = treinta mil pesos, NO 30 pesos.
- NUNCA interpretes el punto como decimal en precios argentinos.
- Por eso copiá los valores COMO ESTÁN en la imagen (como strings).

REGLAS SOBRE IVA:
- Si la factura es tipo A o M, los precios unitarios suelen ser NETOS (sin IVA) y el IVA se suma abajo.
- Si es tipo B o C, suelen ser FINALES (con IVA incluido).
- Extraé el porcentaje de IVA (21% es el general, 10.5% reducido).
- Si no hay IVA visible, dejá taxPercent y taxAmountRaw en null.

OTRAS REGLAS:
- Ignorá códigos de referencia (CC-001), fechas, números de factura, dirección, CUIT, CBU.
- Solo extraé líneas de productos reales con cantidad y precio.
- Si no se puede leer una línea, no la incluyas.
- Si la imagen no es un remito/factura/lista válido, devolvé items: [].`

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (!can(session.user.role, "recharges:create"))
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const plan = await getPlan(tenantId!)
  if (!hasFeature(plan, "feature:ai_assistant_full")) {
    return NextResponse.json(
      {
        error: "Análisis con IA disponible desde plan Profesional",
        code: "FEATURE_LOCKED",
        requiredPlan: "PROFESSIONAL",
      },
      { status: 402 }
    )
  }

  const formData = await req.formData()
  const file = formData.get("image") as File | null
  const supplierId = formData.get("supplierId") as string | null

  if (!file) return NextResponse.json({ error: "No se subió ninguna imagen" }, { status: 400 })
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Imagen demasiado grande (máx 8 MB)" }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Archivo no es una imagen válida" }, { status: 400 })
  }

  // Read image and convert to base64 data URL
  let dataUrl: string
  try {
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    dataUrl = `data:${file.type};base64,${base64}`
  } catch (e) {
    return NextResponse.json({ error: "No se pudo procesar la imagen" }, { status: 400 })
  }

  // Load products (optionally filtered by supplier)
  const products = await db.product.findMany({
    where: {
      tenantId: tenantId!,
      active: true,
      ...(supplierId ? { supplierId } : {}),
    },
    select: {
      id: true,
      name: true,
      costPrice: true,
      salePrice: true,
      stock: true,
      barcode: true,
    },
    orderBy: { name: "asc" },
  })

  const candidates: ProductCandidate[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    costPrice: Number(p.costPrice),
    salePrice: Number(p.salePrice),
    stock: p.stock,
    barcode: p.barcode,
  }))

  // Call OpenAI with vision
  let parsed: {
    supplierHint: string | null
    invoiceType?: "A" | "B" | "C" | "M" | "X" | null
    subtotalRaw?: string | null
    taxPercent?: number | null
    taxAmountRaw?: string | null
    totalRaw?: string | null
    items: Array<{
      rawName: string
      quantity: number | string
      unitCost?: number | string
      totalCost?: number | string
      unitCostRaw?: string
      totalCostRaw?: string
      unit: string | null
    }>
  }

  try {
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0,
    })

    const raw = response.choices[0]?.message?.content ?? "{}"
    parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.items)) parsed.items = []
  } catch (err) {
    console.error("[analyze-image] OpenAI error:", err)
    return NextResponse.json(
      { error: "No se pudo analizar la imagen. Probá con una foto más clara." },
      { status: 502 }
    )
  }

  // Fuzzy match each detected item to product catalog
  const matched = parsed.items.map((item) => {
    const quantity = Math.max(1, Math.round(parseARS(item.quantity) || 1))
    // Prefer raw strings with Argentine format; fallback to legacy numeric fields
    const unitCost = Math.max(0, parseARS(item.unitCostRaw ?? item.unitCost ?? 0))
    const totalCost = Math.max(0, parseARS(item.totalCostRaw ?? item.totalCost ?? 0))

    // If unit cost is suspiciously small but total is large, derive from total
    // (handles AI misreads like "$1.25" when total is "$30.000")
    let finalUnitCost = unitCost
    if (totalCost > 0 && quantity > 0) {
      const derived = totalCost / quantity
      // If the derived value is >10× the AI-reported unitCost, trust the total
      if (unitCost > 0 && derived / unitCost > 10) {
        finalUnitCost = derived
      } else if (unitCost === 0) {
        finalUnitCost = derived
      }
    }

    return {
      rawName: item.rawName || "Sin nombre",
      quantity,
      unitCost: finalUnitCost,
      totalCost: totalCost > 0 ? totalCost : finalUnitCost * quantity,
      unit: item.unit,
      match: matchProduct(item.rawName || "", candidates),
    }
  })

  // Try supplier hint matching if not explicitly passed
  let supplierHintMatch: { id: string; name: string } | null = null
  if (parsed.supplierHint) {
    const suppliers = await db.supplier.findMany({
      where: { tenantId: tenantId!, active: true },
      select: { id: true, name: true },
    })
    const hintScored = suppliers
      .map((s) => ({ s, score: similarityScore(parsed.supplierHint!, s.name) }))
      .sort((a, b) => b.score - a.score)
    if (hintScored[0] && hintScored[0].score >= 0.5) {
      supplierHintMatch = hintScored[0].s
    }
  }

  // Log usage (increments AI quota)
  try {
    await db.auditLog.create({
      data: {
        action: "AI_IMAGE_ANALYSIS",
        entity: "Recharge",
        entityId: null,
        userId: session.user.id!,
        newValue: JSON.stringify({
          items: matched.length,
          supplierHint: parsed.supplierHint,
        }),
      },
    })
  } catch (e) {
    // non-fatal
  }

  // Invoice-level fiscal info
  const invoiceSubtotal = parseARS(parsed.subtotalRaw ?? 0)
  const invoiceTaxAmount = parseARS(parsed.taxAmountRaw ?? 0)
  const invoiceTotal = parseARS(parsed.totalRaw ?? 0)
  const computedItemsSum = matched.reduce((s, i) => s + i.totalCost, 0)

  // If AI gave us a subtotal but items don't sum up, prefer the items (they're line-level truth)
  const finalSubtotal = invoiceSubtotal > 0 ? invoiceSubtotal : computedItemsSum
  const hasTax = (parsed.taxPercent ?? 0) > 0 || invoiceTaxAmount > 0
  const taxPercent = parsed.taxPercent ?? (hasTax && finalSubtotal > 0 ? Math.round((invoiceTaxAmount / finalSubtotal) * 100) : null)
  const finalTotal = invoiceTotal > 0 ? invoiceTotal : finalSubtotal + invoiceTaxAmount

  return NextResponse.json({
    items: matched,
    supplierHint: parsed.supplierHint,
    supplierHintMatch,
    totalDetected: matched.length,
    invoice: {
      type: parsed.invoiceType ?? null,
      subtotal: finalSubtotal,
      taxPercent,
      taxAmount: invoiceTaxAmount,
      total: finalTotal,
      hasTax,
    },
  })
}

// Local import to avoid circular
function similarityScore(a: string, b: string): number {
  const na = a.toLowerCase().trim()
  const nb = b.toLowerCase().trim()
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.8
  const tokensA = new Set(na.split(/\s+/))
  const tokensB = new Set(nb.split(/\s+/))
  let shared = 0
  tokensA.forEach((t) => { if (tokensB.has(t)) shared++ })
  return shared / (tokensA.size + tokensB.size - shared || 1)
}
