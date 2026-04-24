import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can, hasFeature } from "@/lib/permissions"
import type { Plan } from "@/lib/utils"
import { getOpenAI } from "@/lib/openai"
import { matchProduct, type ProductCandidate } from "@/lib/fuzzy-match"

async function getPlan(tenantId: string): Promise<Plan> {
  const sub = await db.subscription.findUnique({
    where: { tenantId },
    select: { plan: true },
  })
  return (sub?.plan as Plan) ?? "FREE"
}

const PROMPT = `Sos un asistente que lee remitos, facturas o listas de proveedores argentinos (bebidas, kioscos, almacenes).

Tu tarea: extraer cada línea de producto de la imagen con los siguientes campos.

Devolvé SOLO un JSON válido con esta estructura exacta:
{
  "supplierHint": "Nombre del proveedor si aparece visible (logo o encabezado), o null",
  "items": [
    {
      "rawName": "nombre del producto tal como aparece",
      "quantity": número entero de cantidad (default 1 si no aparece),
      "unitCost": precio unitario como número (0 si no aparece),
      "totalCost": precio total de la línea como número (0 si no aparece),
      "unit": "unidad|pack|caja|kg|lt" o null
    }
  ]
}

Reglas:
- Si hay cantidad y total pero no precio unitario, calculá unitario = total / cantidad.
- Si hay unitario y cantidad pero no total, calculá total = unitario × cantidad.
- Los números son SIN símbolo $ ni comas de miles (ej: 1250.50, no "$1.250,50").
- Ignorá totales, subtotales, IVA, descuentos globales, fechas, números de factura.
- Si no se puede leer una línea, no la incluyas.
- Si la imagen no es una planilla/remito válido, devolvé items: [].`

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
    items: Array<{
      rawName: string
      quantity: number
      unitCost: number
      totalCost: number
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
  const matched = parsed.items.map((item) => ({
    rawName: item.rawName || "Sin nombre",
    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    unitCost: Math.max(0, Number(item.unitCost) || 0),
    totalCost: Math.max(0, Number(item.totalCost) || 0),
    unit: item.unit,
    match: matchProduct(item.rawName || "", candidates),
  }))

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

  return NextResponse.json({
    items: matched,
    supplierHint: parsed.supplierHint,
    supplierHintMatch,
    totalDetected: matched.length,
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
