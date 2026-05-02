import { NextResponse } from "next/server"

/**
 * Digital Asset Links — vincula este dominio con la app Android (TWA).
 * Configurable via env vars:
 *   - TWA_PACKAGE_NAME = com.orvex.app
 *   - TWA_SHA256_FINGERPRINTS = "AA:BB:CC:..., DD:EE:FF:..." (separadas por coma)
 *
 * Cómo conseguir el fingerprint:
 *   keytool -list -v -keystore my-keystore.jks -alias my-alias
 *
 * Si no están seteados los env vars, devolvemos array vacío (válido pero
 * no asocia ninguna app — el TWA mostraría la barra de Chrome).
 */
export const dynamic = "force-static"
export const revalidate = 3600

export async function GET() {
  const packageName = process.env.TWA_PACKAGE_NAME
  const fingerprints = process.env.TWA_SHA256_FINGERPRINTS
    ?.split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^[0-9A-F:]{95}$/.test(f))

  if (!packageName || !fingerprints || fingerprints.length === 0) {
    return NextResponse.json([])
  }

  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  })
}
