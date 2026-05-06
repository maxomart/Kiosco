/**
 * Catálogo curado de productos típicos de kioscos argentinos con variantes
 * específicas (tamaño, sabor, presentación). Sirve como SEED del autocomplete
 * de inventario para que un kiosco nuevo pueda cargar productos comunes con
 * un click sin tipear nada.
 *
 * Cada producto trae:
 *  - name: nombre completo con variante ("Coca-Cola 2.25L")
 *  - brand: marca padre ("Coca-Cola")
 *  - category: categoría sugerida
 *  - supplier: fabricante/distribuidor argentino
 *  - approxSalePrice / approxCostPrice: precios orientativos en pesos arg
 *    (mayo 2026, ajustar con inflación). El user puede sobrescribirlos.
 *  - searchTerms: variantes de búsqueda (lowercase, sin acentos)
 *
 * Diseñado para que `searchCatalog("coca")` devuelva las 6 variantes de
 * Coca-Cola en lugar de solo "Coca Cola" genérico.
 *
 * No incluye códigos de barras (EANs) porque ponerlos sin verificar contra
 * GS1 sería arriesgado — el user los carga cuando los escanea.
 */

export interface CatalogProduct {
  name: string
  brand: string
  category: string
  supplier: string
  approxSalePrice?: number
  approxCostPrice?: number
  searchTerms: string[]
}

export const ARGENTINE_PRODUCT_CATALOG: CatalogProduct[] = [
  // ─── BEBIDAS GASEOSAS ──────────────────────────────────────────────
  { name: "Coca-Cola 2.25L", brand: "Coca-Cola", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 3500, approxCostPrice: 2700, searchTerms: ["coca", "coca cola", "cocacola", "coca 2.25", "coca grande"] },
  { name: "Coca-Cola 1.5L", brand: "Coca-Cola", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 2800, approxCostPrice: 2100, searchTerms: ["coca", "coca cola", "coca 1.5", "coca litro y medio"] },
  { name: "Coca-Cola 600ml", brand: "Coca-Cola", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 1800, approxCostPrice: 1300, searchTerms: ["coca", "coca cola", "coca 600", "coca chica"] },
  { name: "Coca-Cola lata 354ml", brand: "Coca-Cola", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 1500, approxCostPrice: 1100, searchTerms: ["coca", "coca lata", "coca 354", "lata coca"] },
  { name: "Coca-Cola Zero 2.25L", brand: "Coca-Cola Zero", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 3500, approxCostPrice: 2700, searchTerms: ["coca", "coca zero", "zero", "coca cola zero"] },
  { name: "Coca-Cola Zero 1.5L", brand: "Coca-Cola Zero", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 2800, approxCostPrice: 2100, searchTerms: ["coca", "coca zero", "zero", "coca cola zero 1.5"] },
  { name: "Coca-Cola Zero lata 354ml", brand: "Coca-Cola Zero", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 1500, approxCostPrice: 1100, searchTerms: ["coca", "coca zero", "zero lata"] },
  { name: "Coca-Cola Light 1.5L", brand: "Coca-Cola Light", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 2800, approxCostPrice: 2100, searchTerms: ["coca", "coca light", "light", "coca cola light"] },
  { name: "Sprite 2.25L", brand: "Sprite", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 3300, approxCostPrice: 2500, searchTerms: ["sprite", "lima limón", "lima"] },
  { name: "Sprite 1.5L", brand: "Sprite", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 2700, approxCostPrice: 2000, searchTerms: ["sprite", "lima limón"] },
  { name: "Sprite lata 354ml", brand: "Sprite", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 1400, approxCostPrice: 1050, searchTerms: ["sprite lata"] },
  { name: "Fanta Naranja 2.25L", brand: "Fanta", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 3300, approxCostPrice: 2500, searchTerms: ["fanta", "fanta naranja", "naranja"] },
  { name: "Fanta Naranja 1.5L", brand: "Fanta", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 2700, approxCostPrice: 2000, searchTerms: ["fanta", "naranja"] },
  { name: "Pepsi 2.25L", brand: "Pepsi", category: "Bebidas", supplier: "PepsiCo Argentina", approxSalePrice: 3300, approxCostPrice: 2500, searchTerms: ["pepsi", "pepsi 2.25"] },
  { name: "Pepsi 1.5L", brand: "Pepsi", category: "Bebidas", supplier: "PepsiCo Argentina", approxSalePrice: 2700, approxCostPrice: 2000, searchTerms: ["pepsi"] },
  { name: "Pepsi 600ml", brand: "Pepsi", category: "Bebidas", supplier: "PepsiCo Argentina", approxSalePrice: 1700, approxCostPrice: 1250, searchTerms: ["pepsi", "pepsi chica"] },
  { name: "Pepsi Black 2.25L", brand: "Pepsi Black", category: "Bebidas", supplier: "PepsiCo Argentina", approxSalePrice: 3300, approxCostPrice: 2500, searchTerms: ["pepsi", "pepsi black", "pepsi sin"] },
  { name: "7Up 2.25L", brand: "7Up", category: "Bebidas", supplier: "PepsiCo Argentina", approxSalePrice: 3300, approxCostPrice: 2500, searchTerms: ["7up", "seven up", "lima limón"] },
  { name: "7Up 1.5L", brand: "7Up", category: "Bebidas", supplier: "PepsiCo Argentina", approxSalePrice: 2700, approxCostPrice: 2000, searchTerms: ["7up", "seven up"] },
  { name: "Mirinda Naranja 1.5L", brand: "Mirinda", category: "Bebidas", supplier: "PepsiCo Argentina", approxSalePrice: 2700, approxCostPrice: 2000, searchTerms: ["mirinda", "naranja"] },
  { name: "Manaos 2.25L", brand: "Manaos", category: "Bebidas", supplier: "Refres Now", approxSalePrice: 1800, approxCostPrice: 1300, searchTerms: ["manaos", "manaos 2.25"] },
  { name: "Manaos 600ml", brand: "Manaos", category: "Bebidas", supplier: "Refres Now", approxSalePrice: 900, approxCostPrice: 600, searchTerms: ["manaos"] },

  // ─── AGUAS ─────────────────────────────────────────────────────────
  { name: "Villavicencio 500ml", brand: "Villavicencio", category: "Aguas", supplier: "Danone Argentina", approxSalePrice: 1300, approxCostPrice: 950, searchTerms: ["villavicencio", "agua mineral", "agua"] },
  { name: "Villavicencio 1.5L", brand: "Villavicencio", category: "Aguas", supplier: "Danone Argentina", approxSalePrice: 2200, approxCostPrice: 1600, searchTerms: ["villavicencio", "agua"] },
  { name: "Villa del Sur 500ml", brand: "Villa del Sur", category: "Aguas", supplier: "Danone Argentina", approxSalePrice: 1100, approxCostPrice: 800, searchTerms: ["villa del sur", "villa", "agua"] },
  { name: "Villa del Sur 1.5L", brand: "Villa del Sur", category: "Aguas", supplier: "Danone Argentina", approxSalePrice: 1800, approxCostPrice: 1300, searchTerms: ["villa del sur", "agua"] },
  { name: "Eco de los Andes 500ml", brand: "Eco de los Andes", category: "Aguas", supplier: "Coca-Cola Argentina", approxSalePrice: 1200, approxCostPrice: 850, searchTerms: ["eco", "andes", "agua", "eco de los andes"] },

  // ─── ENERGIZANTES Y JUGOS ──────────────────────────────────────────
  { name: "Speed Energy 500ml", brand: "Speed", category: "Bebidas", supplier: "PepsiCo Argentina", approxSalePrice: 2200, approxCostPrice: 1600, searchTerms: ["speed", "energizante", "speed 500"] },
  { name: "Red Bull 250ml", brand: "Red Bull", category: "Bebidas", supplier: "Red Bull Argentina", approxSalePrice: 3500, approxCostPrice: 2700, searchTerms: ["red bull", "redbull", "energizante"] },
  { name: "Monster Energy 473ml", brand: "Monster", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 3200, approxCostPrice: 2400, searchTerms: ["monster", "energizante"] },
  { name: "Gatorade 500ml", brand: "Gatorade", category: "Bebidas", supplier: "PepsiCo Argentina", approxSalePrice: 2000, approxCostPrice: 1500, searchTerms: ["gatorade", "isotonica", "gatorade 500"] },
  { name: "Powerade 500ml", brand: "Powerade", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 2000, approxCostPrice: 1500, searchTerms: ["powerade", "isotonica"] },
  { name: "Cepita Naranja 1L", brand: "Cepita", category: "Bebidas", supplier: "Coca-Cola Argentina", approxSalePrice: 1800, approxCostPrice: 1300, searchTerms: ["cepita", "jugo", "naranja"] },

  // ─── CERVEZAS ──────────────────────────────────────────────────────
  { name: "Quilmes 1L", brand: "Quilmes", category: "Cervezas", supplier: "Cervecería y Maltería Quilmes", approxSalePrice: 2500, approxCostPrice: 1800, searchTerms: ["quilmes", "cerveza", "quilmes 1l"] },
  { name: "Quilmes 970ml", brand: "Quilmes", category: "Cervezas", supplier: "Cervecería y Maltería Quilmes", approxSalePrice: 2400, approxCostPrice: 1750, searchTerms: ["quilmes", "cerveza"] },
  { name: "Quilmes lata 473ml", brand: "Quilmes", category: "Cervezas", supplier: "Cervecería y Maltería Quilmes", approxSalePrice: 1800, approxCostPrice: 1300, searchTerms: ["quilmes", "lata", "quilmes lata"] },
  { name: "Brahma 1L", brand: "Brahma", category: "Cervezas", supplier: "Cervecería y Maltería Quilmes", approxSalePrice: 2300, approxCostPrice: 1650, searchTerms: ["brahma", "cerveza"] },
  { name: "Stella Artois 473ml lata", brand: "Stella Artois", category: "Cervezas", supplier: "Cervecería y Maltería Quilmes", approxSalePrice: 2400, approxCostPrice: 1700, searchTerms: ["stella", "stella artois", "lata"] },
  { name: "Heineken lata 473ml", brand: "Heineken", category: "Cervezas", supplier: "CCU Argentina", approxSalePrice: 2600, approxCostPrice: 1900, searchTerms: ["heineken", "cerveza"] },
  { name: "Corona 330ml", brand: "Corona", category: "Cervezas", supplier: "Cervecería y Maltería Quilmes", approxSalePrice: 2800, approxCostPrice: 2100, searchTerms: ["corona", "cerveza"] },

  // ─── CIGARRILLOS ───────────────────────────────────────────────────
  { name: "Marlboro Box 20", brand: "Marlboro", category: "Cigarrillos", supplier: "Massalin Particulares", approxSalePrice: 4500, approxCostPrice: 3800, searchTerms: ["marlboro", "marlboro box", "cigarrillos"] },
  { name: "Marlboro Red 20", brand: "Marlboro", category: "Cigarrillos", supplier: "Massalin Particulares", approxSalePrice: 4500, approxCostPrice: 3800, searchTerms: ["marlboro", "marlboro red", "marlboro rojo"] },
  { name: "Marlboro Lights 20", brand: "Marlboro", category: "Cigarrillos", supplier: "Massalin Particulares", approxSalePrice: 4500, approxCostPrice: 3800, searchTerms: ["marlboro", "marlboro lights", "lights"] },
  { name: "Philip Morris 20", brand: "Philip Morris", category: "Cigarrillos", supplier: "Massalin Particulares", approxSalePrice: 4000, approxCostPrice: 3400, searchTerms: ["philip", "philip morris"] },
  { name: "Camel 20", brand: "Camel", category: "Cigarrillos", supplier: "British American Tobacco", approxSalePrice: 4200, approxCostPrice: 3500, searchTerms: ["camel"] },
  { name: "Lucky Strike 20", brand: "Lucky Strike", category: "Cigarrillos", supplier: "British American Tobacco", approxSalePrice: 4200, approxCostPrice: 3500, searchTerms: ["lucky", "lucky strike"] },
  { name: "Parliament 20", brand: "Parliament", category: "Cigarrillos", supplier: "Massalin Particulares", approxSalePrice: 5000, approxCostPrice: 4200, searchTerms: ["parliament"] },

  // ─── GOLOSINAS Y CHOCOLATES ────────────────────────────────────────
  { name: "Bon o Bon individual", brand: "Bon o Bon", category: "Golosinas", supplier: "Arcor", approxSalePrice: 350, approxCostPrice: 230, searchTerms: ["bon o bon", "bonobón", "bon", "chocolate"] },
  { name: "Bon o Bon caja x18", brand: "Bon o Bon", category: "Golosinas", supplier: "Arcor", approxSalePrice: 5000, approxCostPrice: 3800, searchTerms: ["bon o bon", "bonobón", "caja"] },
  { name: "Cofler Aireado 100g", brand: "Cofler", category: "Chocolates", supplier: "Arcor", approxSalePrice: 1500, approxCostPrice: 1100, searchTerms: ["cofler", "cofler aireado", "chocolate"] },
  { name: "Cofler Block 60g", brand: "Cofler", category: "Chocolates", supplier: "Arcor", approxSalePrice: 1100, approxCostPrice: 800, searchTerms: ["cofler", "cofler block", "chocolate"] },
  { name: "Sugus pastilla", brand: "Sugus", category: "Golosinas", supplier: "Arcor", approxSalePrice: 250, approxCostPrice: 170, searchTerms: ["sugus", "pastilla", "caramelo"] },
  { name: "Topline Pellets x14", brand: "Topline", category: "Golosinas", supplier: "Arcor", approxSalePrice: 800, approxCostPrice: 550, searchTerms: ["topline", "chicle"] },
  { name: "Beldent x10", brand: "Beldent", category: "Golosinas", supplier: "Mondelez Argentina", approxSalePrice: 800, approxCostPrice: 550, searchTerms: ["beldent", "chicle"] },
  { name: "Halls Mentol", brand: "Halls", category: "Golosinas", supplier: "Mondelez Argentina", approxSalePrice: 600, approxCostPrice: 420, searchTerms: ["halls", "mentol", "caramelo"] },
  { name: "Mogul Tubo", brand: "Mogul", category: "Golosinas", supplier: "Arcor", approxSalePrice: 700, approxCostPrice: 480, searchTerms: ["mogul", "tubo"] },
  { name: "Marroc", brand: "Marroc", category: "Chocolates", supplier: "Felfort", approxSalePrice: 400, approxCostPrice: 260, searchTerms: ["marroc", "chocolate"] },
  { name: "Tita", brand: "Tita", category: "Chocolates", supplier: "Bagley", approxSalePrice: 600, approxCostPrice: 400, searchTerms: ["tita", "alfajor"] },
  { name: "Rhodesia", brand: "Rhodesia", category: "Chocolates", supplier: "Bagley", approxSalePrice: 600, approxCostPrice: 400, searchTerms: ["rhodesia", "alfajor"] },
  { name: "Águila Felfort 100g", brand: "Águila", category: "Chocolates", supplier: "Felfort", approxSalePrice: 1300, approxCostPrice: 950, searchTerms: ["aguila", "chocolate", "felfort"] },

  // ─── GALLETITAS ────────────────────────────────────────────────────
  { name: "Oreo 118g", brand: "Oreo", category: "Galletitas", supplier: "Mondelez Argentina", approxSalePrice: 1500, approxCostPrice: 1100, searchTerms: ["oreo", "galletita"] },
  { name: "Oreo Mini", brand: "Oreo", category: "Galletitas", supplier: "Mondelez Argentina", approxSalePrice: 900, approxCostPrice: 650, searchTerms: ["oreo", "oreo mini"] },
  { name: "Pepitos 175g", brand: "Pepitos", category: "Galletitas", supplier: "Bagley", approxSalePrice: 1400, approxCostPrice: 1000, searchTerms: ["pepitos", "galletita"] },
  { name: "Chocolinas 170g", brand: "Chocolinas", category: "Galletitas", supplier: "Bagley", approxSalePrice: 1400, approxCostPrice: 1000, searchTerms: ["chocolinas", "galletita"] },
  { name: "Sonrisas 130g", brand: "Sonrisas", category: "Galletitas", supplier: "Bagley", approxSalePrice: 1300, approxCostPrice: 950, searchTerms: ["sonrisas", "galletita"] },
  { name: "Toddy 200g", brand: "Toddy", category: "Galletitas", supplier: "Bagley", approxSalePrice: 1600, approxCostPrice: 1200, searchTerms: ["toddy", "galletita"] },
  { name: "Variedades Bagley", brand: "Variedades", category: "Galletitas", supplier: "Bagley", approxSalePrice: 1700, approxCostPrice: 1250, searchTerms: ["variedades", "surtido", "bagley"] },
  { name: "Cerealitas Salvado", brand: "Cerealitas", category: "Galletitas", supplier: "Bagley", approxSalePrice: 1600, approxCostPrice: 1200, searchTerms: ["cerealitas", "salvado"] },

  // ─── LÁCTEOS ───────────────────────────────────────────────────────
  { name: "La Serenísima leche entera 1L", brand: "La Serenísima", category: "Lácteos", supplier: "Mastellone Hermanos", approxSalePrice: 1900, approxCostPrice: 1450, searchTerms: ["serenisima", "la serenisima", "leche", "leche entera"] },
  { name: "La Serenísima leche descremada 1L", brand: "La Serenísima", category: "Lácteos", supplier: "Mastellone Hermanos", approxSalePrice: 1900, approxCostPrice: 1450, searchTerms: ["serenisima", "leche", "descremada"] },
  { name: "Yogurísimo Bebible 1L", brand: "Yogurísimo", category: "Lácteos", supplier: "Mastellone Hermanos", approxSalePrice: 2200, approxCostPrice: 1650, searchTerms: ["yogurisimo", "yogur", "bebible"] },
  { name: "Casancrem 290g", brand: "Casancrem", category: "Lácteos", supplier: "Mastellone Hermanos", approxSalePrice: 2400, approxCostPrice: 1800, searchTerms: ["casancrem", "queso crema"] },
  { name: "Sancor leche entera 1L", brand: "Sancor", category: "Lácteos", supplier: "Sancor", approxSalePrice: 1850, approxCostPrice: 1400, searchTerms: ["sancor", "leche"] },

  // ─── SNACKS ────────────────────────────────────────────────────────
  { name: "Lay's clásicas 137g", brand: "Lay's", category: "Snacks", supplier: "PepsiCo Argentina", approxSalePrice: 2100, approxCostPrice: 1550, searchTerms: ["lays", "lay's", "papas", "papitas"] },
  { name: "Lay's grande 220g", brand: "Lay's", category: "Snacks", supplier: "PepsiCo Argentina", approxSalePrice: 3200, approxCostPrice: 2400, searchTerms: ["lays", "papas", "papas grandes"] },
  { name: "3D snacks 90g", brand: "3D", category: "Snacks", supplier: "PepsiCo Argentina", approxSalePrice: 1100, approxCostPrice: 800, searchTerms: ["3d", "tres d", "snack"] },
  { name: "Doritos Queso 80g", brand: "Doritos", category: "Snacks", supplier: "PepsiCo Argentina", approxSalePrice: 1400, approxCostPrice: 1000, searchTerms: ["doritos", "queso"] },
  { name: "Cheetos 80g", brand: "Cheetos", category: "Snacks", supplier: "PepsiCo Argentina", approxSalePrice: 1400, approxCostPrice: 1000, searchTerms: ["cheetos", "snack"] },
  { name: "Pringles tubo 124g", brand: "Pringles", category: "Snacks", supplier: "Kellogg's", approxSalePrice: 3500, approxCostPrice: 2700, searchTerms: ["pringles", "papas", "tubo"] },
  { name: "Mantecol", brand: "Mantecol", category: "Snacks", supplier: "Mondelez Argentina", approxSalePrice: 1500, approxCostPrice: 1100, searchTerms: ["mantecol"] },

  // ─── FIAMBRES Y EMBUTIDOS ──────────────────────────────────────────
  { name: "Vienissima salchicha x6", brand: "Vienissima", category: "Fiambres", supplier: "Paladini", approxSalePrice: 2500, approxCostPrice: 1900, searchTerms: ["vienissima", "salchicha", "pancho"] },
  { name: "Salchicha Paladini x6", brand: "Paladini", category: "Fiambres", supplier: "Paladini", approxSalePrice: 2300, approxCostPrice: 1750, searchTerms: ["paladini", "salchicha"] },

  // ─── ALMACÉN ──────────────────────────────────────────────────────
  { name: "Pan lactal Bimbo", brand: "Bimbo", category: "Panificados", supplier: "Bimbo Argentina", approxSalePrice: 2800, approxCostPrice: 2100, searchTerms: ["pan lactal", "bimbo", "pan"] },
  { name: "Mayonesa Hellmann's 250g", brand: "Hellmann's", category: "Almacén", supplier: "Unilever Argentina", approxSalePrice: 1900, approxCostPrice: 1400, searchTerms: ["hellmanns", "hellmann's", "mayonesa"] },
  { name: "Ketchup Hellmann's 250g", brand: "Hellmann's", category: "Almacén", supplier: "Unilever Argentina", approxSalePrice: 1900, approxCostPrice: 1400, searchTerms: ["ketchup", "hellmanns"] },
  { name: "Aceite Natura 900ml", brand: "Natura", category: "Almacén", supplier: "Molinos Río de la Plata", approxSalePrice: 3200, approxCostPrice: 2400, searchTerms: ["natura", "aceite", "girasol"] },
  { name: "Yerba Cruz de Malta 500g", brand: "Cruz de Malta", category: "Yerba Mate", supplier: "Molinos Río de la Plata", approxSalePrice: 3500, approxCostPrice: 2700, searchTerms: ["yerba", "cruz de malta", "mate"] },
  { name: "Yerba Taragüí 500g", brand: "Taragüí", category: "Yerba Mate", supplier: "Las Marías", approxSalePrice: 3400, approxCostPrice: 2600, searchTerms: ["yerba", "taragui", "tarague", "mate"] },
  { name: "Yerba Rosamonte 500g", brand: "Rosamonte", category: "Yerba Mate", supplier: "Hreñuk", approxSalePrice: 3300, approxCostPrice: 2500, searchTerms: ["yerba", "rosamonte", "mate"] },
  { name: "Azúcar Ledesma 1kg", brand: "Ledesma", category: "Almacén", supplier: "Ledesma", approxSalePrice: 1800, approxCostPrice: 1350, searchTerms: ["azucar", "ledesma"] },
  { name: "Café La Virginia 250g", brand: "La Virginia", category: "Almacén", supplier: "La Virginia", approxSalePrice: 4500, approxCostPrice: 3500, searchTerms: ["cafe", "la virginia", "virginia"] },
  { name: "Té Verde Lipton x25", brand: "Lipton", category: "Almacén", supplier: "Unilever Argentina", approxSalePrice: 1500, approxCostPrice: 1100, searchTerms: ["lipton", "te", "té"] },
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Busca en el catálogo curado por nombre o search term. Devuelve productos
 * ordenados por relevancia (match exacto > prefix > substring).
 *
 * Si la query es muy genérica ("coca"), va a devolver TODAS las variantes
 * — eso es deseable para que el user vea el menú completo (Zero, Light,
 * 2.25L, 1.5L, 600ml, lata).
 */
export function searchCatalog(query: string, limit = 8): CatalogProduct[] {
  const q = normalize(query)
  if (q.length < 2) return []

  type Scored = { product: CatalogProduct; score: number }
  const results: Scored[] = []

  for (const p of ARGENTINE_PRODUCT_CATALOG) {
    const name = normalize(p.name)
    let score = 0

    // Match exacto en nombre = mejor
    if (name === q) score = 100
    else if (name.startsWith(q)) score = 80
    else if (name.includes(q)) score = 60

    // Match en search terms (variantes)
    for (const term of p.searchTerms) {
      const t = normalize(term)
      if (t === q) score = Math.max(score, 70)
      else if (t.startsWith(q)) score = Math.max(score, 50)
      else if (t.includes(q) || q.includes(t)) score = Math.max(score, 30)
    }

    // Match en brand
    const brand = normalize(p.brand)
    if (brand === q) score = Math.max(score, 60)
    else if (brand.includes(q) || q.includes(brand)) score = Math.max(score, 25)

    if (score > 0) results.push({ product: p, score })
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit).map((r) => r.product)
}
