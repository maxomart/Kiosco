import { NextResponse } from "next/server"

/**
 * Devuelve info del último release de Orvex Desktop publicado en GitHub
 * (asset URLs por plataforma + versión + fecha). El page /descargar lo
 * consume para mostrar el botón con el link correcto, o "próximamente"
 * si todavía no hay release publicado.
 *
 * Antes el page hardcodeaba URLs tipo
 *   github.com/maxomart/Kiosco/releases/latest/download/Orvex-mac-arm64.dmg
 * que daban 404 si nadie había publicado un release todavía. Ahora el
 * page detecta el estado y muestra UI correspondiente.
 *
 * Cache: la respuesta se cachea 5 minutos para no consumir rate limit
 * de GitHub (60 reqs/hora por IP sin auth) en cada visit.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Cache en memoria del lado server. Para una app multi-instancia es
// best-effort (cada instancia tiene su propio cache, pero si todas
// pegan a GitHub en simultáneo, son N requests en lugar de 1 — OK).
let cache: { ts: number; data: ReleaseInfo } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

const REPO = "maxomart/Kiosco"

interface ReleaseInfo {
  available: boolean
  version?: string
  publishedAt?: string
  htmlUrl?: string
  /** Asset por plataforma. URL apunta directo al binario. */
  assets?: {
    macArm64?: string
    macIntel?: string
    winInstaller?: string
    winPortable?: string
    linuxAppImage?: string
    linuxDeb?: string
  }
}

interface GitHubAsset {
  name: string
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  name: string
  published_at: string
  html_url: string
  draft: boolean
  prerelease: boolean
  assets: GitHubAsset[]
}

function classifyAsset(name: string): keyof NonNullable<ReleaseInfo["assets"]> | null {
  const n = name.toLowerCase()
  // Mac DMG
  if (n.endsWith(".dmg")) {
    if (n.includes("arm64") || n.includes("aarch64")) return "macArm64"
    if (n.includes("x64") || n.includes("intel") || n.includes("x86_64")) return "macIntel"
    // DMG sin sufijo de arquitectura: lo damos como Apple Silicon (más común)
    return "macArm64"
  }
  // Windows
  if (n.endsWith(".exe")) {
    // Convención NSIS: "Orvex Setup 0.1.0.exe" o "Orvex-Setup.exe"
    if (n.includes("setup") || n.includes("installer")) return "winInstaller"
    if (n.includes("portable")) return "winPortable"
    return "winInstaller"
  }
  // Linux
  if (n.endsWith(".appimage")) return "linuxAppImage"
  if (n.endsWith(".deb")) return "linuxDeb"
  return null
}

export async function GET() {
  // Cache hit — devolvemos sin pegarle a GitHub.
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(cache.data, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    })
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
        // Si tenemos GITHUB_TOKEN sumamos auth para subir el rate limit
        // de 60 → 5000 reqs/hora. Funciona también sin token.
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      // 8s timeout — GitHub Pages a veces se demora un poco.
      signal: AbortSignal.timeout(8000),
    })

    // 404 = todavía no hay release publicado. Es el caso esperado en
    // los primeros días del proyecto. Devolvemos available:false.
    if (res.status === 404) {
      const data: ReleaseInfo = { available: false }
      cache = { ts: Date.now(), data }
      return NextResponse.json(data)
    }

    if (!res.ok) {
      // Otro error (rate limit, GitHub down). Devolvemos available:false
      // pero NO cacheamos para que el próximo visit vuelva a probar.
      console.warn(`[api/desktop/release] GitHub returned ${res.status}`)
      return NextResponse.json({ available: false } satisfies ReleaseInfo)
    }

    const release = (await res.json()) as GitHubRelease

    // Skip drafts y prereleases — solo queremos releases estables públicos.
    if (release.draft || release.prerelease) {
      const data: ReleaseInfo = { available: false }
      cache = { ts: Date.now(), data }
      return NextResponse.json(data)
    }

    const assets: NonNullable<ReleaseInfo["assets"]> = {}
    for (const asset of release.assets ?? []) {
      const slot = classifyAsset(asset.name)
      if (slot && !assets[slot]) {
        assets[slot] = asset.browser_download_url
      }
    }

    const data: ReleaseInfo = {
      available: Object.keys(assets).length > 0,
      version: release.tag_name?.replace(/^v/, ""),
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
      assets,
    }
    cache = { ts: Date.now(), data }
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    })
  } catch (err: any) {
    console.warn("[api/desktop/release] error:", err?.message)
    return NextResponse.json({ available: false } satisfies ReleaseInfo)
  }
}
