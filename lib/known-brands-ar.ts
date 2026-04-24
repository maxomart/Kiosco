/**
 * Diccionario curado de marcas argentinas y sus fabricantes/distribuidores.
 * Prioriza contra llamar a IA porque es:
 *  - Determinístico (no alucinación)
 *  - Gratis (sin tokens)
 *  - Rápido (lookup en memoria)
 *  - Actualizable manualmente cuando cambia el mercado
 *
 * Cada key es un "pattern" — si aparece como substring en el nombre del
 * producto (normalizado), matchea. Los patterns más específicos deben ir
 * ANTES que los más generales.
 */

export interface BrandMatch {
  supplier: string
  category?: string
  confidence: "high" | "medium"
}

// Keys: lowercase, sin acentos, sin caracteres especiales
export const KNOWN_BRANDS: Record<string, BrandMatch> = {
  // ════════ BEBIDAS SIN ALCOHOL ════════
  // Coca-Cola Argentina S.A.
  "coca cola": { supplier: "Coca-Cola Argentina", category: "Bebidas", confidence: "high" },
  "coca-cola": { supplier: "Coca-Cola Argentina", category: "Bebidas", confidence: "high" },
  "cocacola": { supplier: "Coca-Cola Argentina", category: "Bebidas", confidence: "high" },
  "sprite": { supplier: "Coca-Cola Argentina", category: "Bebidas", confidence: "high" },
  "fanta": { supplier: "Coca-Cola Argentina", category: "Bebidas", confidence: "high" },
  "schweppes": { supplier: "Coca-Cola Argentina", category: "Bebidas", confidence: "high" },
  "powerade": { supplier: "Coca-Cola Argentina", category: "Bebidas", confidence: "high" },
  "aquarius": { supplier: "Coca-Cola Argentina", category: "Bebidas", confidence: "high" },
  "dasani": { supplier: "Coca-Cola Argentina", category: "Bebidas", confidence: "high" },
  "kin": { supplier: "Coca-Cola Argentina", category: "Bebidas", confidence: "high" },
  "cepita": { supplier: "Coca-Cola Argentina", category: "Bebidas", confidence: "high" },
  "ades": { supplier: "Coca-Cola Argentina", category: "Bebidas", confidence: "high" },

  // PepsiCo Argentina
  "pepsi": { supplier: "PepsiCo Argentina", category: "Bebidas", confidence: "high" },
  "7up": { supplier: "PepsiCo Argentina", category: "Bebidas", confidence: "high" },
  "seven up": { supplier: "PepsiCo Argentina", category: "Bebidas", confidence: "high" },
  "mirinda": { supplier: "PepsiCo Argentina", category: "Bebidas", confidence: "high" },
  "gatorade": { supplier: "PepsiCo Argentina", category: "Bebidas", confidence: "high" },
  "h2oh": { supplier: "PepsiCo Argentina", category: "Bebidas", confidence: "high" },
  "paso de los toros": { supplier: "PepsiCo Argentina", category: "Bebidas", confidence: "high" },
  "paso": { supplier: "PepsiCo Argentina", category: "Bebidas", confidence: "medium" },
  "manaos": { supplier: "Refres Now", category: "Bebidas", confidence: "high" },
  "villa del sur": { supplier: "Danone", category: "Bebidas", confidence: "high" },
  "villavicencio": { supplier: "Danone", category: "Bebidas", confidence: "high" },
  "ivess": { supplier: "Aguas Ivess", category: "Bebidas", confidence: "high" },
  "eco de los andes": { supplier: "Nestlé Waters", category: "Bebidas", confidence: "high" },
  "pureza vital": { supplier: "Nestlé Waters", category: "Bebidas", confidence: "high" },
  "nestea": { supplier: "Nestlé", category: "Bebidas", confidence: "high" },
  "red bull": { supplier: "Red Bull Argentina", category: "Bebidas", confidence: "high" },
  "speed": { supplier: "Cervecería y Maltería Quilmes", category: "Bebidas", confidence: "medium" },
  "monster": { supplier: "Monster Energy", category: "Bebidas", confidence: "high" },

  // ════════ CERVEZAS / ALCOHOL ════════
  "quilmes": { supplier: "Cervecería y Maltería Quilmes", category: "Bebidas", confidence: "high" },
  "brahma": { supplier: "Cervecería y Maltería Quilmes", category: "Bebidas", confidence: "high" },
  "stella artois": { supplier: "Cervecería y Maltería Quilmes", category: "Bebidas", confidence: "high" },
  "corona": { supplier: "Cervecería y Maltería Quilmes", category: "Bebidas", confidence: "high" },
  "patagonia": { supplier: "Cervecería y Maltería Quilmes", category: "Bebidas", confidence: "high" },
  "andes": { supplier: "CCU Argentina", category: "Bebidas", confidence: "high" },
  "heineken": { supplier: "CCU Argentina", category: "Bebidas", confidence: "high" },
  "imperial": { supplier: "CCU Argentina", category: "Bebidas", confidence: "high" },
  "isenbeck": { supplier: "Warsteiner Group", category: "Bebidas", confidence: "medium" },
  "fernet branca": { supplier: "Fratelli Branca", category: "Bebidas", confidence: "high" },
  "branca": { supplier: "Fratelli Branca", category: "Bebidas", confidence: "medium" },
  "fernet": { supplier: "Fratelli Branca", category: "Bebidas", confidence: "medium" },
  "gancia": { supplier: "Cinzano Argentina", category: "Bebidas", confidence: "high" },
  "cinzano": { supplier: "Cinzano Argentina", category: "Bebidas", confidence: "high" },

  // ════════ GOLOSINAS Y CHOCOLATES ════════
  "arcor": { supplier: "Arcor", category: "Golosinas", confidence: "high" },
  "bon o bon": { supplier: "Arcor", category: "Golosinas", confidence: "high" },
  "bon bon": { supplier: "Arcor", category: "Golosinas", confidence: "medium" },
  "cofler": { supplier: "Arcor", category: "Golosinas", confidence: "high" },
  "aguila": { supplier: "Arcor", category: "Golosinas", confidence: "medium" },
  "butter toffees": { supplier: "Arcor", category: "Golosinas", confidence: "high" },
  "tofi": { supplier: "Arcor", category: "Golosinas", confidence: "high" },
  "menthoplus": { supplier: "Arcor", category: "Golosinas", confidence: "high" },
  "topline": { supplier: "Arcor", category: "Golosinas", confidence: "high" },
  "mogul": { supplier: "Arcor", category: "Golosinas", confidence: "high" },
  "rocklets": { supplier: "Arcor", category: "Golosinas", confidence: "high" },
  "sugus": { supplier: "Arcor", category: "Golosinas", confidence: "high" },
  "misky": { supplier: "Arcor", category: "Golosinas", confidence: "high" },
  "billiken": { supplier: "Arcor", category: "Golosinas", confidence: "medium" },

  // Mondelez
  "milka": { supplier: "Mondelez Argentina", category: "Golosinas", confidence: "high" },
  "shot": { supplier: "Mondelez Argentina", category: "Golosinas", confidence: "medium" },
  "beldent": { supplier: "Mondelez Argentina", category: "Golosinas", confidence: "high" },
  "bubbaloo": { supplier: "Mondelez Argentina", category: "Golosinas", confidence: "high" },
  "bazooka": { supplier: "Topps", category: "Golosinas", confidence: "medium" },
  "halls": { supplier: "Mondelez Argentina", category: "Golosinas", confidence: "high" },
  "oreo": { supplier: "Mondelez Argentina", category: "Galletitas", confidence: "high" },
  "toblerone": { supplier: "Mondelez Argentina", category: "Golosinas", confidence: "high" },
  "cadbury": { supplier: "Mondelez Argentina", category: "Golosinas", confidence: "high" },

  // Felfort
  "felfort": { supplier: "Felfort", category: "Golosinas", confidence: "high" },
  "aguila felfort": { supplier: "Felfort", category: "Golosinas", confidence: "high" },
  "jorgelin": { supplier: "Felfort", category: "Golosinas", confidence: "high" },
  "jorgito": { supplier: "Jorgito", category: "Golosinas", confidence: "high" },

  // Otros
  "9 de oro": { supplier: "9 de Oro", category: "Panificados", confidence: "high" },
  "9 oro": { supplier: "9 de Oro", category: "Panificados", confidence: "medium" },
  "havanna": { supplier: "Havanna", category: "Golosinas", confidence: "high" },
  "guaymallen": { supplier: "Guaymallén", category: "Golosinas", confidence: "high" },
  "capitan del espacio": { supplier: "Capitán del Espacio", category: "Golosinas", confidence: "high" },
  "terrabusi": { supplier: "Mondelez Argentina", category: "Galletitas", confidence: "high" },

  // ════════ GALLETITAS ════════
  "bagley": { supplier: "Arcor", category: "Galletitas", confidence: "high" },
  "oreo": { supplier: "Mondelez Argentina", category: "Galletitas", confidence: "high" },
  "chocolinas": { supplier: "Arcor", category: "Galletitas", confidence: "high" },
  "sonrisas": { supplier: "Arcor", category: "Galletitas", confidence: "high" },
  "rumba": { supplier: "Arcor", category: "Galletitas", confidence: "high" },
  "opera": { supplier: "Arcor", category: "Galletitas", confidence: "medium" },
  "toddy": { supplier: "Mondelez Argentina", category: "Galletitas", confidence: "high" },
  "pepitos": { supplier: "Arcor", category: "Galletitas", confidence: "high" },
  "melba": { supplier: "Arcor", category: "Galletitas", confidence: "medium" },
  "surtido bagley": { supplier: "Arcor", category: "Galletitas", confidence: "high" },
  "chocolinas": { supplier: "Arcor", category: "Galletitas", confidence: "high" },
  "criollitas": { supplier: "Arcor", category: "Galletitas", confidence: "high" },
  "express": { supplier: "Arcor", category: "Galletitas", confidence: "medium" },
  "formis": { supplier: "Arcor", category: "Galletitas", confidence: "medium" },
  "merengadas": { supplier: "Arcor", category: "Galletitas", confidence: "medium" },
  "hogareñas": { supplier: "Arcor", category: "Galletitas", confidence: "medium" },

  // ════════ LÁCTEOS ════════
  "la serenisima": { supplier: "Mastellone Hermanos", category: "Lácteos", confidence: "high" },
  "serenisima": { supplier: "Mastellone Hermanos", category: "Lácteos", confidence: "medium" },
  "sancor": { supplier: "SanCor", category: "Lácteos", confidence: "high" },
  "danone": { supplier: "Danone Argentina", category: "Lácteos", confidence: "high" },
  "yogurisimo": { supplier: "Mastellone Hermanos", category: "Lácteos", confidence: "high" },
  "actimel": { supplier: "Danone Argentina", category: "Lácteos", confidence: "high" },
  "activia": { supplier: "Danone Argentina", category: "Lácteos", confidence: "high" },
  "casancrem": { supplier: "Mastellone Hermanos", category: "Lácteos", confidence: "high" },
  "ilolay": { supplier: "Ilolay", category: "Lácteos", confidence: "high" },
  "tregar": { supplier: "Tregar", category: "Lácteos", confidence: "high" },
  "milkaut": { supplier: "Milkaut", category: "Lácteos", confidence: "high" },

  // ════════ ALMACÉN / FIDEOS / ACEITE ════════
  "molinos": { supplier: "Molinos Río de la Plata", category: "Almacén", confidence: "high" },
  "matarazzo": { supplier: "Molinos Río de la Plata", category: "Almacén", confidence: "high" },
  "luchetti": { supplier: "Molinos Río de la Plata", category: "Almacén", confidence: "high" },
  "lucchetti": { supplier: "Molinos Río de la Plata", category: "Almacén", confidence: "high" },
  "don vicente": { supplier: "Molinos Río de la Plata", category: "Almacén", confidence: "high" },
  "gallo": { supplier: "Molinos Río de la Plata", category: "Almacén", confidence: "medium" },
  "marolio": { supplier: "Marolio", category: "Almacén", confidence: "high" },
  "natura": { supplier: "Aceitera General Deheza", category: "Almacén", confidence: "medium" },
  "cocinero": { supplier: "Aceitera General Deheza", category: "Almacén", confidence: "high" },
  "legitimo": { supplier: "Aceitera General Deheza", category: "Almacén", confidence: "medium" },

  // Arroz
  "molto": { supplier: "Arrocera Argentina", category: "Almacén", confidence: "medium" },
  "gallo oro": { supplier: "Molinos Río de la Plata", category: "Almacén", confidence: "high" },
  "dos hermanos": { supplier: "Molino Ala", category: "Almacén", confidence: "high" },

  // Conservas
  "la campagnola": { supplier: "Arcor", category: "Almacén", confidence: "high" },
  "campagnola": { supplier: "Arcor", category: "Almacén", confidence: "high" },
  "arveja marolio": { supplier: "Marolio", category: "Almacén", confidence: "high" },

  // ════════ LIMPIEZA / HIGIENE ════════
  "magistral": { supplier: "Procter & Gamble", category: "Limpieza", confidence: "high" },
  "ayudin": { supplier: "Unilever Argentina", category: "Limpieza", confidence: "high" },
  "cif": { supplier: "Unilever Argentina", category: "Limpieza", confidence: "high" },
  "skip": { supplier: "Unilever Argentina", category: "Limpieza", confidence: "high" },
  "ala": { supplier: "Unilever Argentina", category: "Limpieza", confidence: "high" },
  "drive": { supplier: "Unilever Argentina", category: "Limpieza", confidence: "high" },
  "ariel": { supplier: "Procter & Gamble", category: "Limpieza", confidence: "high" },
  "vanish": { supplier: "Reckitt Benckiser", category: "Limpieza", confidence: "high" },
  "mr musculo": { supplier: "SC Johnson", category: "Limpieza", confidence: "high" },
  "poett": { supplier: "Clorox Argentina", category: "Limpieza", confidence: "high" },
  "ayudin clorinado": { supplier: "Clorox Argentina", category: "Limpieza", confidence: "medium" },

  // Higiene personal
  "dove": { supplier: "Unilever Argentina", category: "Higiene", confidence: "high" },
  "lux": { supplier: "Unilever Argentina", category: "Higiene", confidence: "high" },
  "rexona": { supplier: "Unilever Argentina", category: "Higiene", confidence: "high" },
  "axe": { supplier: "Unilever Argentina", category: "Higiene", confidence: "high" },
  "sedal": { supplier: "Unilever Argentina", category: "Higiene", confidence: "high" },
  "suave": { supplier: "Unilever Argentina", category: "Higiene", confidence: "medium" },
  "colgate": { supplier: "Colgate-Palmolive", category: "Higiene", confidence: "high" },
  "palmolive": { supplier: "Colgate-Palmolive", category: "Higiene", confidence: "high" },
  "head and shoulders": { supplier: "Procter & Gamble", category: "Higiene", confidence: "high" },
  "pantene": { supplier: "Procter & Gamble", category: "Higiene", confidence: "high" },
  "gillette": { supplier: "Procter & Gamble", category: "Higiene", confidence: "high" },
  "elvive": { supplier: "L'Oréal", category: "Higiene", confidence: "high" },

  // Papel higiénico
  "higienol": { supplier: "Celulosa Argentina", category: "Higiene", confidence: "high" },
  "elite": { supplier: "Papelera del Plata", category: "Higiene", confidence: "high" },
  "scott": { supplier: "Kimberly-Clark", category: "Higiene", confidence: "high" },
  "suave papel": { supplier: "Papelera del Plata", category: "Higiene", confidence: "medium" },

  // ════════ YERBA Y INFUSIONES ════════
  "playadito": { supplier: "Cooperativa Agrícola Liebig", category: "Almacén", confidence: "high" },
  "taragui": { supplier: "Las Marías", category: "Almacén", confidence: "high" },
  "cbse": { supplier: "CBSé", category: "Almacén", confidence: "high" },
  "rosamonte": { supplier: "Hreñuk", category: "Almacén", confidence: "high" },
  "cruz de malta": { supplier: "Molinos Río de la Plata", category: "Almacén", confidence: "high" },
  "union": { supplier: "Establecimiento Las Marías", category: "Almacén", confidence: "medium" },

  // ════════ CIGARRILLOS ════════
  "marlboro": { supplier: "Massalin Particulares (Philip Morris)", category: "Cigarrillos", confidence: "high" },
  "philip morris": { supplier: "Massalin Particulares (Philip Morris)", category: "Cigarrillos", confidence: "high" },
  "l&m": { supplier: "Massalin Particulares (Philip Morris)", category: "Cigarrillos", confidence: "high" },
  "chesterfield": { supplier: "Massalin Particulares (Philip Morris)", category: "Cigarrillos", confidence: "high" },
  "parliament": { supplier: "Massalin Particulares (Philip Morris)", category: "Cigarrillos", confidence: "high" },
  "lucky strike": { supplier: "British American Tobacco", category: "Cigarrillos", confidence: "high" },
  "camel": { supplier: "British American Tobacco", category: "Cigarrillos", confidence: "high" },
  "pall mall": { supplier: "British American Tobacco", category: "Cigarrillos", confidence: "high" },
  "derby": { supplier: "Massalin Particulares (Philip Morris)", category: "Cigarrillos", confidence: "medium" },
  "jockey club": { supplier: "Tabacalera Sarandí", category: "Cigarrillos", confidence: "high" },
  "le mans": { supplier: "Massalin Particulares (Philip Morris)", category: "Cigarrillos", confidence: "high" },
  "viceroy": { supplier: "British American Tobacco", category: "Cigarrillos", confidence: "high" },
}

// Normalize string for matching: lowercase, strip accents and non-alphanum
function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Try to match a product name against the known brands dictionary.
 * Returns the most specific (longest) match, or null if nothing matches.
 */
export function lookupKnownBrand(productName: string): BrandMatch | null {
  const normalized = normalizeKey(productName)
  if (!normalized) return null

  // Sort keys by length DESC so longer/more-specific patterns win
  // (e.g. "coca cola" matches before "coca" alone)
  const sortedKeys = Object.keys(KNOWN_BRANDS).sort((a, b) => b.length - a.length)

  for (const key of sortedKeys) {
    const pattern = normalizeKey(key)
    if (!pattern) continue
    // Match as whole-word or substring within tokens
    const tokens = normalized.split(" ")
    const patternTokens = pattern.split(" ")
    // If all pattern tokens are present in normalized name, it's a match
    const allPresent = patternTokens.every((pt) => tokens.some((t) => t.includes(pt)))
    if (allPresent) {
      return KNOWN_BRANDS[key]
    }
  }

  return null
}
