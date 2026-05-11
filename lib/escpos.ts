/**
 * Mini-builder de comandos ESC/POS — el protocolo que entienden las
 * impresoras térmicas de tickets (Xprinter, EPSON TM-T20, 3nStar, Bixolon,
 * etc). En lugar de mandar HTML al navegador y que la impresora "dibuje"
 * el render, le mandamos comandos binarios crudos que la impresora ejecuta
 * directo. Resultado: impresión instantánea, sin diálogo de navegador.
 *
 * Referencia oficial:
 *   https://reference.epson-biz.com/modules/ref_escpos/index.php
 *
 * No es exhaustivo — sólo lo que necesitamos para etiquetas y tickets de
 * venta (texto, alineación, tamaño, barcode, corte).
 */

// ============================================================================
// Comandos ESC/POS — bytes mágicos definidos por el estándar de EPSON
// ============================================================================
const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

// Codificación CP437 — la mayoría de impresoras térmicas argentinas usan
// page 0 (default). Si tenés problemas con acentos, hay que cambiar la
// code page con ESC t n.

/**
 * Builder fluido para armar un buffer ESC/POS de a poco. Al final llamás
 * .build() y te da un Uint8Array listo para mandar a la impresora.
 */
export class ESCPOSBuilder {
  private chunks: number[] = []

  /** Resetea estado de la impresora (margenes, alineación, fuente). */
  init() {
    this.chunks.push(ESC, 0x40) // ESC @
    return this
  }

  /** Texto plano. Convierte a bytes CP437. */
  text(s: string) {
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i)
      // ASCII directo
      if (code < 0x80) {
        this.chunks.push(code)
        continue
      }
      // Caracteres latinos comunes (CP437/CP850 approximation)
      const map: Record<string, number> = {
        á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3,
        Á: 0xb5, É: 0x90, Í: 0xd6, Ó: 0xe0, Ú: 0xe9,
        ñ: 0xa4, Ñ: 0xa5, ü: 0x81, Ü: 0x9a,
        "¡": 0xad, "¿": 0xa8, "°": 0xf8,
      }
      this.chunks.push(map[s[i]] ?? 0x3f) // ? para chars no mapeados
    }
    return this
  }

  /** Salto de línea. */
  feed(n = 1) {
    for (let i = 0; i < n; i++) this.chunks.push(LF)
    return this
  }

  /** Alineación: left | center | right */
  align(a: "left" | "center" | "right") {
    const n = a === "left" ? 0 : a === "center" ? 1 : 2
    this.chunks.push(ESC, 0x61, n) // ESC a n
    return this
  }

  /** Bold on/off */
  bold(on: boolean) {
    this.chunks.push(ESC, 0x45, on ? 1 : 0) // ESC E n
    return this
  }

  /** Tamaño: 1 = normal, 2 = doble alto, 3 = doble ancho, 4 = doble x doble */
  size(s: 1 | 2 | 3 | 4) {
    const n = s === 1 ? 0x00 : s === 2 ? 0x01 : s === 3 ? 0x10 : 0x11
    this.chunks.push(GS, 0x21, n) // GS ! n
    return this
  }

  /** Imprime un código de barras. type: "EAN13" (13 dígitos), "CODE128", "CODE39" */
  barcode(data: string, type: "EAN13" | "CODE128" | "CODE39" = "CODE128", height = 64) {
    // GS h n → altura del barcode
    this.chunks.push(GS, 0x68, height)
    // GS w n → ancho del módulo (2 = thin, 3 = medium, 4 = thick)
    this.chunks.push(GS, 0x77, 2)
    // GS H n → posición de texto (0=none, 2=below)
    this.chunks.push(GS, 0x48, 2)

    // GS k m d1...dk 00 → print barcode (format m=73 = CODE128, m=2 = EAN13, m=4 = CODE39)
    if (type === "EAN13") {
      // Function A: GS k 2 d1...d12 NUL
      this.chunks.push(GS, 0x6b, 0x02)
      for (let i = 0; i < data.length && i < 12; i++) {
        this.chunks.push(data.charCodeAt(i))
      }
      this.chunks.push(0x00)
    } else if (type === "CODE39") {
      this.chunks.push(GS, 0x6b, 0x04)
      for (let i = 0; i < data.length; i++) {
        this.chunks.push(data.charCodeAt(i))
      }
      this.chunks.push(0x00)
    } else {
      // CODE128 con Function B: GS k 73 n d1...dn (n = longitud)
      const bytes: number[] = []
      // Prefijo "{B" para CODE128 modo B (chars imprimibles)
      bytes.push(0x7b, 0x42)
      for (let i = 0; i < data.length; i++) bytes.push(data.charCodeAt(i))
      this.chunks.push(GS, 0x6b, 0x49, bytes.length)
      for (const b of bytes) this.chunks.push(b)
    }
    return this
  }

  /** Corte parcial (la impresora deja un puente chico — el usuario tira). */
  cut() {
    this.chunks.push(GS, 0x56, 0x42, 0x00) // GS V B 0
    return this
  }

  /** Devuelve el buffer final listo para mandar por WebUSB. */
  build(): Uint8Array {
    return new Uint8Array(this.chunks)
  }
}

// ============================================================================
// Templates de alto nivel para los casos comunes
// ============================================================================

interface LabelInput {
  productName: string
  price: string         // ya formateado con $
  barcode?: string | null
  businessName?: string | null
}

/**
 * Genera el comando ESC/POS para imprimir UNA etiqueta de producto.
 * Layout: business name (chico) → product name (grande, bold) → barcode →
 * precio (grande, bold) → feed + cut.
 */
export function buildLabelCommand(input: LabelInput): Uint8Array {
  const b = new ESCPOSBuilder().init().align("center")

  if (input.businessName) {
    b.size(1).text(input.businessName.toUpperCase()).feed(1)
  }

  // Nombre del producto en grande
  b.size(2).bold(true).text(input.productName).bold(false).feed(1)

  // Barcode (si tiene)
  if (input.barcode) {
    b.size(1).barcode(input.barcode, "CODE128").feed(1)
  }

  // Precio enorme
  b.size(4).bold(true).text(input.price).bold(false).feed(2)

  // Cut y feed extra para que el corte quede limpio
  b.feed(2).cut()
  return b.build()
}

/**
 * Imprime varias etiquetas concatenadas (un buffer con todas).
 */
export function buildLabelsBatch(labels: LabelInput[]): Uint8Array {
  const chunks: Uint8Array[] = []
  for (const l of labels) chunks.push(buildLabelCommand(l))
  // Concatenar
  const total = chunks.reduce((acc, c) => acc + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}
