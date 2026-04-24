/**
 * Argentine number formatting helpers.
 *
 * Argentina uses:
 *   . for thousand separator
 *   , for decimal separator
 * Example: 1.250.000,50
 */

/** Format a numeric value for display with ARS conventions. */
export function formatARS(value: number, decimals = 0): string {
  if (!isFinite(value)) return ""
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Parse a user-typed string back into a number. Returns 0 on invalid. */
export function parseARSNumber(str: string): number {
  if (!str) return 0
  // Remove spaces and currency symbol
  let s = str.replace(/[$\s]/g, "")
  if (!s) return 0

  // If both . and , are present → assume . is thousands separator, , is decimal
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".")
  }
  // Only comma → treat as decimal
  else if (s.includes(",")) {
    s = s.replace(",", ".")
  }
  // Only dots → if looks like thousands (groups of 3), strip dots
  else if (s.includes(".")) {
    const parts = s.split(".")
    if (parts.length > 1 && parts.slice(1).every((p) => p.length === 3)) {
      s = s.replace(/\./g, "")
    }
  }

  const n = parseFloat(s)
  return isFinite(n) ? n : 0
}

/**
 * Format a raw input string live as the user types, preserving typed decimals.
 * Keeps intermediate states valid (e.g. "1.2" while typing "1.25").
 */
export function formatInputLive(raw: string): string {
  if (!raw) return ""

  // Remove everything except digits, . and ,
  let cleaned = raw.replace(/[^\d.,]/g, "")

  // Find decimal separator — the LAST comma or dot with <=2 trailing digits
  // In Argentine convention, comma is decimal
  const hasComma = cleaned.includes(",")

  if (hasComma) {
    // Split on last comma — everything before is integer part, after is decimals
    const lastCommaIdx = cleaned.lastIndexOf(",")
    let intPart = cleaned.slice(0, lastCommaIdx).replace(/\./g, "").replace(/,/g, "")
    const decPart = cleaned.slice(lastCommaIdx + 1).replace(/[^\d]/g, "").slice(0, 2)
    const intNum = intPart ? parseInt(intPart, 10) : 0
    const intFormatted = intNum.toLocaleString("es-AR")
    return decPart !== undefined && cleaned.endsWith(",") && !decPart
      ? `${intFormatted},`
      : decPart
      ? `${intFormatted},${decPart}`
      : intFormatted
  } else {
    // No decimal — treat all dots as thousands separators
    const digits = cleaned.replace(/\D/g, "")
    if (!digits) return ""
    const n = parseInt(digits, 10)
    return n.toLocaleString("es-AR")
  }
}

/**
 * Count how many digits/commas exist to the left of cursor position,
 * so we can keep the cursor in the "same place" after reformat.
 */
export function countRelevantBefore(str: string, caret: number): number {
  let count = 0
  for (let i = 0; i < caret && i < str.length; i++) {
    const c = str[i]
    if (/[\d,]/.test(c)) count++
  }
  return count
}

/** After reformatting, find the caret position that matches the same relevant-char count. */
export function placeCaret(formatted: string, relevantCount: number): number {
  if (relevantCount <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/[\d,]/.test(formatted[i])) {
      seen++
      if (seen === relevantCount) return i + 1
    }
  }
  return formatted.length
}
