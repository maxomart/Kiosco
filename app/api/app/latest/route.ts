import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import path from "node:path"

export const dynamic = "force-dynamic"

/**
 * Devuelve metadata del APK actual de Orvex (versión, tamaño, fecha).
 * Lee `public/downloads/orvex.apk` si existe; sino devuelve null.
 *
 * Versión configurable con env var APP_ANDROID_VERSION (ej: "1.0.3").
 */
export async function GET() {
  const apkPath = path.join(process.cwd(), "public", "downloads", "orvex.apk")
  try {
    const stat = await fs.stat(apkPath)
    return NextResponse.json({
      available: true,
      version: process.env.APP_ANDROID_VERSION ?? "1.0.0",
      url: "/downloads/orvex.apk",
      size: stat.size,
      sizeMB: Math.round(stat.size / 1024 / 1024 * 10) / 10,
      lastModified: stat.mtime.toISOString(),
    })
  } catch {
    return NextResponse.json({ available: false })
  }
}
