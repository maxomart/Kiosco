/**
 * AI-powered Excel/CSV import for product catalogs.
 *
 * Flow:
 *   1. parseSpreadsheet(file) → { headers, rows }  (uses xlsx — handles xlsx/csv/xls)
 *   2. mapColumnsWithAI(headers, sampleRows) → { mapping, defaults, notes }
 *      (sends just headers + 5 sample rows to OpenAI to keep tokens low)
 *   3. normalizeRows(rows, mapping, defaults) → ProductImportRow[]
 *      (pure deterministic; the AI is ONLY for column mapping, not row data)
 *
 * The AI never decides individual row values — it only maps "column X means salePrice".
 * That makes the import deterministic, debuggable, and testable.
 */

import * as XLSX from "xlsx"
import { getOpenAI, isOpenAIConfigured, DEFAULT_MODEL } from "@/lib/openai"

export type RawCell = string | number | boolean | null

export interface ParsedSpreadsheet {
  headers: string[]
  rows: Record<string, RawCell>[]
  totalRows: number
  sheetName: string
}

/**
 * Parse a CSV/XLSX/XLS into a normalized shape. Strips empty rows/columns.
 * For huge files, only the first sheet is read (Excel often has multiple).
 */
export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: "array" })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error("El archivo no tiene hojas")
  const ws = wb.Sheets[sheetName]

  // header: 1 → return arrays. We'll find the header row ourselves below
  // because some Excel exports have title rows before the actual headers.
  const matrix = XLSX.utils.sheet_to_json<RawCell[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
  })

  // Detect header row: first row with ≥2 string cells that look like headers
  // (i.e., text, no purely numeric). Skip leading empty/title rows.
  let headerIdx = 0
  for (let i = 0; i < Math.min(10, matrix.length); i++) {
    const r = matrix[i] ?? []
    const stringCells = r.filter(
      (c) => typeof c === "string" && c.trim().length > 0,
    ).length
    const numericCells = r.filter((c) => typeof c === "number").length
    if (stringCells >= 2 && numericCells === 0) {
      headerIdx = i
      break
    }
  }

  const rawHeaders = (matrix[headerIdx] ?? []).map((h, i) =>
    h == null || String(h).trim() === "" ? `Columna ${i + 1}` : String(h).trim(),
  )

  // Deduplicate headers (Excel sometimes has merged-cell artifacts)
  const headers: string[] = []
  const seen = new Map<string, number>()
  for (const h of rawHeaders) {
    const c = seen.get(h) ?? 0
    headers.push(c === 0 ? h : `${h} (${c + 1})`)
    seen.set(h, c + 1)
  }

  const dataRows = matrix.slice(headerIdx + 1)
  const rows = dataRows
    .map((r) => {
      const obj: Record<string, RawCell> = {}
      headers.forEach((h, i) => {
        obj[h] = r[i] ?? null
      })
      return obj
    })
    // Drop empty rows
    .filter((r) =>
      Object.values(r).some(
        (v) => v != null && String(v).trim() !== "" && v !== 0,
      ),
    )

  return { headers, rows, totalRows: rows.length, sheetName }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI mapping
// ─────────────────────────────────────────────────────────────────────────────

export type ProductField =
  | "name"
  | "barcode"
  | "sku"
  | "salePrice"
  | "costPrice"
  | "stock"
  | "minStock"
  | "category"
  | "supplier"
  | "description"
  | "unit"

export interface ColumnMapping {
  /** sourceHeader → targetField (or null = ignore) */
  fields: Partial<Record<ProductField, string | null>>
  /** confidence 0-1 self-reported by the model */
  confidence: number
  /** explanation in Spanish for the user to understand what the AI did */
  notes: string
  /** suggestions like "no encontré columna de costo, sugiero asumir 75% del precio" */
  warnings: string[]
}

const SYSTEM_PROMPT = `Sos un experto en importar planillas de inventario de comercios argentinos (kioscos, almacenes, farmacias, mini-súper).

Te paso los nombres de columnas de una planilla Excel/CSV + las primeras 5 filas de datos. Tu trabajo: mapear cada columna al campo correcto del sistema.

CAMPOS DEL SISTEMA (todos opcionales excepto "name" y "salePrice"):
- name        → nombre del producto (REQUERIDO)
- barcode     → código de barras EAN/UPC (típicamente 13 dígitos)
- sku         → código interno alfanumérico
- salePrice   → precio de venta al público (REQUERIDO)
- costPrice   → precio de costo / lo que le sale al comerciante
- stock       → cantidad actual en stock
- minStock    → stock mínimo / punto de reposición
- category    → categoría del producto (texto libre como "Bebidas", "Limpieza")
- supplier    → proveedor / distribuidora
- description → descripción larga
- unit        → unidad ("un", "kg", "lt") — opcional, default "un"

REGLAS CRÍTICAS:
1. Si hay UNA SOLA columna de precio, ES salePrice (precio de venta). NUNCA es costPrice solo.
2. Si hay DOS columnas de precio, la MÁS ALTA es salePrice y la menor es costPrice.
3. Acepta nombres en español argentino: "Precio", "Precio Venta", "P. Venta", "Costo", "Mi Costo", "$",
   "Cód", "Código de Barras", "EAN", "Producto", "Descripción", "Cant", "Stock", "Categ", "Rubro".
4. Si una columna no encaja con ningún campo, mapeala a null (la ignoramos).
5. Sé conservador con confidence: 0.95+ solo si los nombres son obvios; 0.6-0.8 si interpretaste; <0.6 si dudaste.
6. En "warnings" mencioná cosas como "no encontré columna de costo, voy a asumir 75% del precio (margen 25%)" o "la columna 'Precio' parece tener algunos valores como texto".

DEVOLVÉ SOLO JSON válido con este schema EXACTO:
{
  "fields": {
    "name": "<nombreColumnaDelArchivo>" | null,
    "barcode": "..." | null,
    "sku": "..." | null,
    "salePrice": "..." | null,
    "costPrice": "..." | null,
    "stock": "..." | null,
    "minStock": "..." | null,
    "category": "..." | null,
    "supplier": "..." | null,
    "description": "..." | null,
    "unit": "..." | null
  },
  "confidence": 0.95,
  "notes": "Detecté columnas en español. Asumo 'Precio' como precio de venta...",
  "warnings": ["No hay columna de costo — voy a asumir 75% del precio"]
}

Nada de markdown, nada de texto extra. SOLO el JSON.`

/**
 * Asks OpenAI to map columns. If OpenAI is not configured or fails,
 * falls back to a deterministic heuristic so the import never fully blocks.
 */
export async function mapColumnsWithAI(
  headers: string[],
  sampleRows: Record<string, RawCell>[],
): Promise<ColumnMapping> {
  const heuristic = heuristicMap(headers, sampleRows)

  if (!isOpenAIConfigured()) {
    heuristic.warnings.unshift(
      "Asistente IA no configurado — usé detección automática básica. Revisá las columnas antes de importar.",
    )
    return heuristic
  }

  try {
    const openai = getOpenAI()
    const userPayload = {
      columnas: headers,
      primeras_filas: sampleRows.slice(0, 5),
    }
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      max_tokens: 600,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    })
    const content = response.choices[0]?.message?.content
    if (!content) return heuristic

    const parsed = JSON.parse(content) as ColumnMapping
    // Validate the AI didn't hallucinate column names
    const valid: Partial<Record<ProductField, string | null>> = {}
    for (const [field, col] of Object.entries(parsed.fields ?? {})) {
      if (col == null) {
        valid[field as ProductField] = null
      } else if (headers.includes(col as string)) {
        valid[field as ProductField] = col as string
      }
    }
    return {
      fields: valid,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
      notes: parsed.notes ?? "",
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    }
  } catch (err) {
    console.error("[import-ai] OpenAI failed, falling back to heuristic", err)
    heuristic.warnings.unshift("La IA falló — usé detección automática.")
    return heuristic
  }
}

/**
 * Deterministic heuristic — used when OpenAI isn't available or as a baseline.
 * Pretty conservative; the AI improves on this.
 */
function heuristicMap(
  headers: string[],
  sampleRows: Record<string, RawCell>[],
): ColumnMapping {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()

  const candidates: Record<ProductField, string[]> = {
    name: ["producto", "nombre", "descripcion", "articulo", "item", "name"],
    barcode: ["codigo de barras", "cod barras", "codigo barras", "barcode", "ean", "upc", "cb"],
    sku: ["sku", "codigo interno", "codigo", "cod", "id"],
    salePrice: ["precio venta", "precio", "p venta", "pvp", "precio publico", "venta", "price", "precio final"],
    costPrice: ["costo", "precio costo", "p costo", "cost", "mi costo", "compra"],
    stock: ["stock", "cantidad", "cant", "existencias", "qty", "inventario"],
    minStock: ["stock minimo", "minimo", "min stock", "minstock", "punto de pedido"],
    category: ["categoria", "rubro", "familia", "category"],
    supplier: ["proveedor", "distribuidora", "marca", "supplier"],
    description: ["descripcion", "desc", "detalle", "description"],
    unit: ["unidad", "unit", "medida"],
  }

  const fields: Partial<Record<ProductField, string | null>> = {}
  const used = new Set<string>()

  for (const field of Object.keys(candidates) as ProductField[]) {
    const cands = candidates[field].map(norm)
    let best: { header: string; score: number } | null = null
    for (const h of headers) {
      if (used.has(h)) continue
      const nh = norm(h)
      for (const c of cands) {
        const score =
          nh === c
            ? 1.0
            : nh.startsWith(c) || nh.endsWith(c)
            ? 0.85
            : nh.includes(c) || c.includes(nh)
            ? 0.7
            : 0
        if (score > 0 && (!best || score > best.score)) {
          best = { header: h, score }
        }
      }
    }
    if (best && best.score >= 0.7) {
      fields[field] = best.header
      used.add(best.header)
    } else {
      fields[field] = null
    }
  }

  // If we found two price-like columns, the bigger one in sample data is salePrice
  if (fields.salePrice && fields.costPrice && sampleRows.length > 0) {
    const sumA = sumNumeric(sampleRows, fields.salePrice)
    const sumB = sumNumeric(sampleRows, fields.costPrice)
    if (sumB > sumA) {
      // swap — costo is actually higher? Then they're misnamed; keep both but warn
    }
  }

  const warnings: string[] = []
  if (!fields.costPrice) warnings.push("No detecté columna de costo — voy a asumir 75% del precio (margen 25%)")
  if (!fields.barcode) warnings.push("Sin columna de código de barras — vas a tener que escanear/escribir cada uno manualmente en el POS")
  if (!fields.stock) warnings.push("Sin columna de stock — voy a asumir 0 unidades")

  return {
    fields,
    confidence: 0.6,
    notes: "Mapeo automático basado en nombres de columnas.",
    warnings,
  }
}

function sumNumeric(rows: Record<string, RawCell>[], col: string): number {
  let s = 0
  for (const r of rows) {
    const v = r[col]
    const n = typeof v === "number" ? v : parseFloat(String(v ?? ""))
    if (!isNaN(n)) s += n
  }
  return s
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalize raw rows → DB-ready ProductImportRow
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductImportRow {
  rowNum: number
  name: string
  barcode: string | null
  sku: string | null
  salePrice: number
  costPrice: number
  stock: number
  minStock: number
  categoryName: string | null
  supplierName: string | null
  description: string | null
  /** parse error for this specific row, if any — caller decides what to do */
  error?: string
}

export interface NormalizeOptions {
  /** Multiplier applied to price when no cost column exists. 0.75 = 25% margin. */
  defaultCostRatio: number
  /** Default min stock when not provided. */
  defaultMinStock: number
}

export function normalizeRows(
  rows: Record<string, RawCell>[],
  mapping: ColumnMapping,
  options: NormalizeOptions = { defaultCostRatio: 0.75, defaultMinStock: 5 },
): ProductImportRow[] {
  const f = mapping.fields
  const out: ProductImportRow[] = []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2 // 1-indexed + header row
    const name = readString(row, f.name)
    const barcodeRaw = readString(row, f.barcode)
    const skuRaw = readString(row, f.sku)
    let salePrice = readNumber(row, f.salePrice)
    let costPrice = readNumber(row, f.costPrice)
    const stock = readNumber(row, f.stock) ?? 0
    const minStock = readNumber(row, f.minStock) ?? options.defaultMinStock
    const categoryName = readString(row, f.category)
    const supplierName = readString(row, f.supplier)
    const description = readString(row, f.description)

    // RULE: highest of the two price-ish numbers is always salePrice.
    // Defensively swap if the user mapped them backwards (real-world Excel chaos).
    if (salePrice != null && costPrice != null && costPrice > salePrice) {
      const t = salePrice
      salePrice = costPrice
      costPrice = t
    }
    // RULE: if no cost given, infer at default ratio (default 75% of price = 25% margin)
    if (salePrice != null && (costPrice == null || costPrice === 0)) {
      costPrice = Math.round(salePrice * options.defaultCostRatio * 100) / 100
    }

    let error: string | undefined
    if (!name) error = "Falta nombre"
    else if (salePrice == null || salePrice <= 0) error = "Precio inválido o ausente"

    // Barcode: keep as string, strip leading "'" some Excel exports add for long numbers
    const barcode = barcodeRaw ? barcodeRaw.replace(/^'/, "").trim() || null : null

    out.push({
      rowNum,
      name: name ?? "",
      barcode,
      sku: skuRaw ?? null,
      salePrice: salePrice ?? 0,
      costPrice: costPrice ?? 0,
      stock: Math.max(0, Math.floor(stock || 0)),
      minStock: Math.max(0, Math.floor(minStock || 0)),
      categoryName: categoryName ?? null,
      supplierName: supplierName ?? null,
      description: description ?? null,
      error,
    })
  })

  return out
}

function readString(row: Record<string, RawCell>, col: string | null | undefined): string | null {
  if (!col) return null
  const v = row[col]
  if (v == null) return null
  const s = String(v).trim()
  return s === "" ? null : s
}

function readNumber(row: Record<string, RawCell>, col: string | null | undefined): number | null {
  if (!col) return null
  const v = row[col]
  if (v == null || v === "") return null
  if (typeof v === "number") return v
  // Argentine number format: "1.234,56" → 1234.56
  // Also handle "$1.500" or "ARS 1500"
  const cleaned = String(v)
    .replace(/[^0-9.,\-]/g, "")
    // If both . and , present, assume . is thousands separator (AR format)
    .replace(/\.(?=\d{3}([.,]|$))/g, "")
    .replace(",", ".")
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}
