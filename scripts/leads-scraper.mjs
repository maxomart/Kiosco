#!/usr/bin/env node
/**
 * ============================================================================
 *  Orvex — Scraper de leads (kioscos, almacenes, farmacias, etc.)
 * ============================================================================
 *
 *  Usa la Google Places API (New) para sacar negocios de CABA + GBA con su
 *  nombre, teléfono, Instagram/web y dirección. Genera un CSV listo para abrir
 *  en Excel y empezar a llamar.
 *
 *  CÓMO CORRERLO:
 *    1. Conseguí una API key de Google (ver scripts/LEADS-README.md)
 *    2. En la terminal, parado en la carpeta del proyecto:
 *
 *         GOOGLE_MAPS_API_KEY=tu_api_key node scripts/leads-scraper.mjs
 *
 *    3. Cuando termina, te deja un archivo leads-orvex-FECHA.csv en la carpeta.
 *
 *  PARA PROBAR PRIMERO SIN GASTAR (recomendado):
 *    Dejá solo 2-3 zonas y 2 rubros en las listas de abajo, corré, y fijate
 *    que el CSV salga bien. Después descomentás todo.
 * ============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURACIÓN — editá libremente estas listas
// ─────────────────────────────────────────────────────────────────────────────

/** Zonas a barrer. Comentá (//) las que no te interesen o agregá las tuyas. */
const ZONAS = [
  // ── CABA ──
  "Palermo", "Belgrano", "Caballito", "Flores", "Almagro", "Recoleta",
  "Villa Crespo", "Villa Urquiza", "Villa Devoto", "Núñez", "Boedo",
  "Liniers", "Mataderos", "Barracas", "La Boca", "Balvanera",
  "Villa Lugano", "Villa del Parque", "Floresta", "Parque Patricios",
  "Saavedra", "Chacarita", "Villa Pueyrredón", "Monte Castro",
  "Parque Chacabuco",
  // ── GBA Sur ──
  "Avellaneda", "Lanús", "Lomas de Zamora", "Banfield", "Quilmes",
  "Bernal", "Berazategui", "Florencio Varela", "Adrogué", "Burzaco",
  "Monte Grande", "Ezeiza",
  // ── GBA Oeste ──
  "San Justo", "Ramos Mejía", "Isidro Casanova", "González Catán",
  "Gregorio de Laferrère", "Morón", "Castelar", "Haedo", "Merlo",
  "Moreno", "Ituzaingó", "Hurlingham", "Caseros", "San Martín",
  "José C. Paz", "San Miguel", "Bella Vista",
  // ── GBA Norte ──
  "Vicente López", "Olivos", "Florida", "San Isidro", "Martínez",
  "Boulogne", "San Fernando", "Tigre", "General Pacheco", "Pilar",
  "Garín", "Escobar",
]

/** Rubros a buscar. Cada uno se cruza con cada zona. */
const RUBROS = [
  "kiosco",
  "maxikiosco",
  "almacén",
  "despensa",
  "autoservicio",
  "minimercado",
  "farmacia",
  "verdulería",
  "fiambrería",
  "dietética",
]

/**
 * Cuántas páginas pedir por búsqueda (cada página = hasta 20 negocios).
 *  - 1 = rápido y barato, ~20 por zona/rubro
 *  - 3 = máximo, ~60 por zona/rubro (recomendado para volumen)
 */
const MAX_PAGINAS = 3

/** Pausa entre requests, en ms. No lo bajes de 100 para no comerte un rate-limit. */
const PAUSA_MS = 150

// ─────────────────────────────────────────────────────────────────────────────
//  A partir de acá no hace falta tocar nada
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from "node:fs"

const API_KEY = process.env.GOOGLE_MAPS_API_KEY

if (!API_KEY) {
  console.error(`
❌ Falta la API key.

Corré el script así:

   GOOGLE_MAPS_API_KEY=tu_api_key node scripts/leads-scraper.mjs

Para conseguir la key, mirá scripts/LEADS-README.md
`)
  process.exit(1)
}

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText"
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.formattedAddress",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "nextPageToken",
].join(",")

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Una página de resultados para una query de texto. */
async function buscarPagina(textQuery, pageToken) {
  const body = {
    textQuery,
    languageCode: "es",
    regionCode: "AR",
    pageSize: 20,
  }
  if (pageToken) body.pageToken = pageToken

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    const err = new Error(`HTTP ${res.status}: ${txt.slice(0, 300)}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

/** Clasifica el contacto: teléfono > Instagram > web > nada. */
function clasificarContacto(telefono, web) {
  const esInstagram = web && /instagram\.com/i.test(web)
  const instagram = esInstagram ? web : ""
  const webLimpia = esInstagram ? "" : web || ""
  let estado
  if (telefono) estado = "CON TELEFONO"
  else if (instagram) estado = "SOLO INSTAGRAM"
  else if (webLimpia) estado = "SOLO WEB"
  else estado = "SIN CONTACTO"
  return { instagram, webLimpia, estado }
}

/** Escapa un valor para CSV. */
function csvCell(v) {
  const s = String(v ?? "")
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

async function main() {
  const totalQueries = ZONAS.length * RUBROS.length
  console.log(`
🔎 Orvex — Scraper de leads
   Zonas:   ${ZONAS.length}
   Rubros:  ${RUBROS.length}
   Búsquedas a hacer: ${totalQueries}  (hasta ${MAX_PAGINAS} páginas c/u)
`)

  // Map por place.id para no repetir un mismo negocio.
  const negocios = new Map()
  let queriesHechas = 0
  let errores = 0

  for (const zona of ZONAS) {
    for (const rubro of RUBROS) {
      queriesHechas++
      const textQuery = `${rubro} en ${zona}, Buenos Aires, Argentina`
      let pageToken = undefined
      let nuevosEnEstaQuery = 0

      for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
        try {
          const data = await buscarPagina(textQuery, pageToken)
          const places = data.places ?? []

          for (const p of places) {
            if (!p.id || negocios.has(p.id)) continue
            const telefono =
              p.nationalPhoneNumber || p.internationalPhoneNumber || ""
            const { instagram, webLimpia, estado } = clasificarContacto(
              telefono,
              p.websiteUri
            )
            negocios.set(p.id, {
              nombre: p.displayName?.text ?? "",
              rubro,
              zona,
              telefono,
              instagram,
              web: webLimpia,
              direccion: p.formattedAddress ?? "",
              rating: p.rating ?? "",
              resenias: p.userRatingCount ?? "",
              googleMaps: p.googleMapsUri ?? "",
              estado,
            })
            nuevosEnEstaQuery++
          }

          pageToken = data.nextPageToken
          if (!pageToken) break
          await sleep(PAUSA_MS)
        } catch (err) {
          errores++
          if (err.status === 403) {
            console.error(`
❌ Error 403 — la API key no es válida o la "Places API (New)" no está
   activada en tu proyecto de Google Cloud. Revisá scripts/LEADS-README.md
   paso 3 y 4. Frenando acá.
`)
            process.exit(1)
          }
          if (err.status === 429) {
            // Rate limit: esperamos un toque y seguimos.
            await sleep(2000)
          }
          console.warn(`   ⚠️  ${textQuery} — ${err.message}`)
          break
        }
      }

      const pct = ((queriesHechas / totalQueries) * 100).toFixed(0)
      console.log(
        `[${pct}%] ${textQuery}  →  +${nuevosEnEstaQuery}  (total únicos: ${negocios.size})`
      )
      await sleep(PAUSA_MS)
    }
  }

  // ── Armar CSV ──
  const filas = [...negocios.values()]
  // Orden: primero los que tienen teléfono, después IG, después el resto.
  const prioridad = {
    "CON TELEFONO": 0,
    "SOLO INSTAGRAM": 1,
    "SOLO WEB": 2,
    "SIN CONTACTO": 3,
  }
  filas.sort((a, b) => {
    const d = prioridad[a.estado] - prioridad[b.estado]
    if (d !== 0) return d
    return (b.resenias || 0) - (a.resenias || 0)
  })

  const cabecera = [
    "Nombre",
    "Rubro",
    "Zona",
    "Telefono",
    "Instagram",
    "Web",
    "Direccion",
    "Rating",
    "Reseñas",
    "Google Maps",
    "Estado",
  ]
  const lineas = [cabecera.join(",")]
  for (const f of filas) {
    lineas.push(
      [
        f.nombre,
        f.rubro,
        f.zona,
        f.telefono,
        f.instagram,
        f.web,
        f.direccion,
        f.rating,
        f.resenias,
        f.googleMaps,
        f.estado,
      ]
        .map(csvCell)
        .join(",")
    )
  }
  // BOM para que Excel respete las tildes.
  const csv = "﻿" + lineas.join("\n")

  const ahora = new Date()
  const stamp = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}-${String(ahora.getHours()).padStart(2, "0")}${String(ahora.getMinutes()).padStart(2, "0")}`
  const nombreArchivo = `leads-orvex-${stamp}.csv`
  writeFileSync(nombreArchivo, csv, "utf8")

  // ── Resumen ──
  const conTel = filas.filter((f) => f.estado === "CON TELEFONO").length
  const soloIg = filas.filter((f) => f.estado === "SOLO INSTAGRAM").length
  const soloWeb = filas.filter((f) => f.estado === "SOLO WEB").length
  const sinNada = filas.filter((f) => f.estado === "SIN CONTACTO").length

  console.log(`
✅ Listo.

   Archivo:          ${nombreArchivo}
   Negocios únicos:  ${filas.length}
   ├─ Con teléfono:  ${conTel}
   ├─ Solo Instagram:${soloIg}
   ├─ Solo web:      ${soloWeb}
   └─ Sin contacto:  ${sinNada}
   Errores de búsqueda: ${errores}

Abrí el CSV con Excel o Google Sheets y empezá a llamar.
`)
}

main().catch((err) => {
  console.error("\n❌ Error inesperado:", err)
  process.exit(1)
})
