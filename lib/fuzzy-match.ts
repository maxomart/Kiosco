/**
 * Simple fuzzy matching for product names.
 * Used to match raw OCR'd names against the product catalog.
 */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Returns a similarity score between 0 and 1 using token overlap (Jaccard-like).
 * Boosts when ALL tokens of the shorter string are present in the longer.
 */
export function similarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  const tokensA = new Set(na.split(" ").filter((t) => t.length > 1))
  const tokensB = new Set(nb.split(" ").filter((t) => t.length > 1))
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let shared = 0
  for (const t of tokensA) if (tokensB.has(t)) shared++

  // Jaccard
  const union = tokensA.size + tokensB.size - shared
  const jaccard = shared / union

  // Boost if all tokens of shorter set are inside larger
  const smaller = tokensA.size < tokensB.size ? tokensA : tokensB
  const larger = tokensA.size < tokensB.size ? tokensB : tokensA
  let allInside = true
  for (const t of smaller) if (!larger.has(t)) { allInside = false; break }
  const boost = allInside ? 0.2 : 0
  return Math.min(1, jaccard + boost)
}

export type MatchStatus = "EXACT" | "PROBABLE" | "SUGGESTIONS" | "UNKNOWN"

export interface ProductCandidate {
  id: string
  name: string
  costPrice: number
  salePrice: number
  stock: number
  barcode: string | null
}

export interface MatchResult {
  rawName: string
  bestMatch: ProductCandidate | null
  bestScore: number
  status: MatchStatus
  suggestions: Array<{ product: ProductCandidate; score: number }>
}

export function matchProduct(
  rawName: string,
  products: ProductCandidate[]
): MatchResult {
  if (products.length === 0) {
    return { rawName, bestMatch: null, bestScore: 0, status: "UNKNOWN", suggestions: [] }
  }

  const scored = products
    .map((p) => ({ product: p, score: similarity(rawName, p.name) }))
    .sort((a, b) => b.score - a.score)

  const top = scored[0]
  const top3 = scored.slice(0, 3).filter((s) => s.score > 0.25)

  let status: MatchStatus
  if (top.score >= 0.9) status = "EXACT"
  else if (top.score >= 0.55) status = "PROBABLE"
  else if (top.score >= 0.25) status = "SUGGESTIONS"
  else status = "UNKNOWN"

  return {
    rawName,
    bestMatch: top.score >= 0.55 ? top.product : null,
    bestScore: top.score,
    status,
    suggestions: top3,
  }
}
