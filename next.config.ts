import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV !== "production"

// Content Security Policy — ajustar connect-src según integraciones
//
// Mercado Pago Brick necesita TODA la familia de dominios (mp + ml + mlstatic),
// con subdominios variables para CDN/anti-fraude/telemetría. Usamos wildcards
// para no jugar al "agregar dominio cada vez que MP saca uno nuevo".
const MP_DOMAINS = [
  "https://*.mercadopago.com",
  "https://*.mercadopago.com.ar",
  "https://*.mercadolibre.com",
  "https://*.mlstatic.com",
  "https://*.mlcdn.com",
]

const cspDirectives: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    ...MP_DOMAINS,
    ...(isDev ? ["'unsafe-eval'"] : []),
  ],
  "style-src": ["'self'", "'unsafe-inline'", ...MP_DOMAINS],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:", ...MP_DOMAINS],
  "connect-src": [
    "'self'",
    "https://api.openai.com",
    "https://api.anthropic.com",
    "https://api.stripe.com",
    "https://api.twilio.com",
    ...MP_DOMAINS,
    ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : []),
  ],
  "frame-src": [
    "'self'",
    "https://js.stripe.com",
    "https://hooks.stripe.com",
    ...MP_DOMAINS,
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
