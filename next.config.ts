import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV !== "production"

// Content Security Policy — ajustar connect-src según integraciones
//
// Mercado Pago Brick necesita ~10 dominios distintos: sdk + assets +
// telemetría + anti-fraude (mercadolibre.com hace device fingerprinting
// para detectar tarjetas robadas). Sin todos estos el formulario carga
// pero se traba al enviar.
const MP_DOMAINS = {
  scripts: [
    "https://sdk.mercadopago.com",
    "https://http2.mlstatic.com",
    "https://www.mercadolibre.com",
  ],
  styles: ["https://http2.mlstatic.com"],
  fonts: ["https://http2.mlstatic.com"],
  connect: [
    "https://api.mercadopago.com",
    "https://api.mercadolibre.com",
    "https://events.mercadopago.com",
    "https://http2.mlstatic.com",
    "https://www.mercadolibre.com",
    "https://www.mercadopago.com",
    "https://www.mercadopago.com.ar",
  ],
  frames: [
    "https://www.mercadopago.com",
    "https://www.mercadopago.com.ar",
    "https://www.mercadolibre.com",
    "https://sdk.mercadopago.com",
    "https://http2.mlstatic.com",
  ],
}

const cspDirectives: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    ...MP_DOMAINS.scripts,
    ...(isDev ? ["'unsafe-eval'"] : []),
  ],
  "style-src": ["'self'", "'unsafe-inline'", ...MP_DOMAINS.styles],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:", ...MP_DOMAINS.fonts],
  "connect-src": [
    "'self'",
    "https://api.openai.com",
    "https://api.anthropic.com",
    "https://api.stripe.com",
    "https://api.twilio.com",
    ...MP_DOMAINS.connect,
    ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : []),
  ],
  "frame-src": [
    "'self'",
    "https://js.stripe.com",
    "https://hooks.stripe.com",
    ...MP_DOMAINS.frames,
  ],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "manifest-src": ["'self'"],
  ...(isDev ? {} : { "upgrade-insecure-requests": [] }),
}

const csp = Object.entries(cspDirectives)
  .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
  .join("; ")

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]),
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy", value: csp },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.cloudinary.com" },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000", "*.up.railway.app", "*.railway.app"] },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ]
  },
}

export default nextConfig
