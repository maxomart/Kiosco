/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Permite localhost (dev) y cualquier subdominio de Railway / Vercel en producción
      allowedOrigins: [
        "localhost:3000",
        "*.up.railway.app",
        "*.railway.app",
        "*.vercel.app",
      ],
    },
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },
}

module.exports = nextConfig
