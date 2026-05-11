import { ImageResponse } from "next/og"

export const runtime = "edge"

/**
 * Generador dinámico de OG images (1200×630 px, formato estándar de
 * Twitter / LinkedIn / WhatsApp / Facebook). Cada landing pasa título
 * y opcionalmente un pill como query params, y este endpoint devuelve
 * un PNG renderizado en el momento, con la branding de Orvex de fondo.
 *
 * URL pattern:
 *   /api/og?title=POS+para+Fiambrería&pill=Para+fiambrerías
 *
 * Beneficios SEO:
 *   - Cada landing tiene su propia preview en redes sociales con su
 *     título (no la imagen genérica de la home).
 *   - Mejor CTR cuando alguien comparte el link en Twitter, WhatsApp,
 *     grupos de Facebook de kiosqueros, etc.
 *   - Google bot también lee este og:image y lo usa en algunas SERPs.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const title = searchParams.get("title")?.slice(0, 120) ?? "Orvex — POS para tu negocio"
    const pill = searchParams.get("pill")?.slice(0, 60) ?? "Sistema de gestión argentino"

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "80px",
            background:
              "linear-gradient(135deg, #050510 0%, #0a0a25 35%, #1a0a40 70%, #2a0a55 100%)",
            position: "relative",
            color: "white",
          }}
        >
          {/* Blob decorativo arriba derecha */}
          <div
            style={{
              position: "absolute",
              top: -200,
              right: -200,
              width: 600,
              height: 600,
              background:
                "radial-gradient(circle, rgba(139,92,246,0.45) 0%, rgba(139,92,246,0) 70%)",
              borderRadius: 9999,
              display: "flex",
            }}
          />
          {/* Blob decorativo abajo izquierda */}
          <div
            style={{
              position: "absolute",
              bottom: -150,
              left: -150,
              width: 500,
              height: 500,
              background:
                "radial-gradient(circle, rgba(59,130,246,0.30) 0%, rgba(59,130,246,0) 70%)",
              borderRadius: 9999,
              display: "flex",
            }}
          />

          {/* Top: pill + brand */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              zIndex: 1,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 20px",
                background: "rgba(139,92,246,0.15)",
                border: "1px solid rgba(139,92,246,0.4)",
                borderRadius: 9999,
                fontSize: 26,
                color: "#c4b5fd",
                fontWeight: 600,
                alignSelf: "flex-start",
              }}
            >
              {pill}
            </div>
          </div>

          {/* Middle: title */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              zIndex: 1,
              maxWidth: 1000,
            }}
          >
            <div
              style={{
                fontSize: title.length > 60 ? 64 : 80,
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: "white",
                display: "flex",
              }}
            >
              {title}
            </div>
          </div>

          {/* Bottom: orvex logo + url */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              zIndex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              {/* Logo monogram */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 38,
                  fontWeight: 900,
                  color: "white",
                }}
              >
                O
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontSize: 36, fontWeight: 800, color: "white" }}>
                  Orvex
                </div>
                <div style={{ fontSize: 22, color: "#9ca3af" }}>
                  cobraorvex.com
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: 22,
                color: "#c4b5fd",
                fontWeight: 600,
                display: "flex",
              }}
            >
              Probalo gratis →
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        // Headers para que CDN / scrapers de Twitter/FB cacheen agresivo
        // — la imagen es deterministic por título.
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      }
    )
  } catch (e) {
    console.error("[/api/og]", e)
    return new Response("Error generating OG image", { status: 500 })
  }
}
