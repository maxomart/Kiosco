import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"

/**
 * Helpers para los endpoints CSV que Google Sheets consume con =IMPORTDATA.
 */

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export function monthLabelEs(d: Date | string | null | undefined): string {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  if (isNaN(date.getTime())) return ""
  return `${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  if (isNaN(date.getTime())) return ""
  // ISO date sin tiempo — Google Sheets lo parsea como fecha automáticamente.
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

/** Escapa una celda CSV — comilla doble y nueva línea/coma fuerzan quotes. */
function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return ""
  const s = String(v)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Devuelve un Response con CSV y headers correctos para IMPORTDATA. */
export function csvResponse(headers: string[], rows: unknown[][]) {
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((r) => r.map(escapeCell).join(",")),
  ]
  // BOM para que Sheets/Excel detecten UTF-8 (acentos en "Teléfono", etc).
  const body = "\uFEFF" + lines.join("\n")
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

/**
 * Verifica el ?token= contra SHEETS_EXPORT_TOKEN. Comparación constant-time
 * para evitar timing attacks.
 *
 * Devuelve null si OK, o un Response 401/500 si falla.
 */
export function requireExportToken(req: NextRequest): NextResponse | null {
  const expected = process.env.SHEETS_EXPORT_TOKEN
  if (!expected || expected.length < 16) {
    return NextResponse.json(
      { error: "SHEETS_EXPORT_TOKEN no configurado en el servidor" },
      { status: 500 },
    )
  }
  const provided = new URL(req.url).searchParams.get("token") ?? ""
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 })
  }
  return null
}
