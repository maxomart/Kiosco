import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "react-hot-toast"
import ServiceWorkerRegistrar from "./sw"
import RotateScreenManager from "@/components/shared/RotateScreenManager"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: { default: "Orvex - Sistema de Gestión", template: "%s | Orvex" },
  description: "Sistema de gestión para negocios retail argentinos: kioscos, farmacias, verdulerías y minisúper",
  applicationName: "Orvex",
  manifest: "/manifest.json",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  ),
  keywords: [
    "software para kiosco",
    "POS Argentina",
    "sistema de gestión kiosco",
    "punto de venta",
    "software farmacia",
    "control de stock",
    "facturación Argentina",
    "caja registradora digital",
    "gestión minisúper",
  ],
  authors: [{ name: "Orvex" }],
  referrer: "strict-origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Orvex - Sistema de Gestión para Negocios",
    description: "POS, inventario y reportes para kioscos, farmacias y minisúper",
    locale: "es_AR",
    type: "website",
    siteName: "Orvex",
    images: [
      {
        url: "/orvex-og.png",
        width: 1254,
        height: 1254,
        alt: "Orvex — Tu negocio, en control",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Orvex - Sistema de Gestión para Negocios",
    description: "POS, inventario y reportes para kioscos, farmacias y minisúper",
    images: ["/orvex-og.png"],
  },
}

export const viewport: Viewport = {
  themeColor: "#050510",
  width: "device-width",
  initialScale: 1,
  // viewport-fit=cover deja que la app dibuje detrás de los notches en
  // iPhone (Dynamic Island) — necesario para que la PWA standalone se
  // vea como app nativa y no como web con barrita blanca arriba.
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" suppressHydrationWarning className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        {/* Performance hints — Core Web Vitals.
            preconnect a fonts.googleapis baja el handshake TLS de Google
            Fonts a 0ms en el primer load (Inter usa next/font pero hace
            fetch en runtime para algunos pesos). dns-prefetch a MP/Stripe
            adelanta resolución DNS para flows de pago. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.mercadopago.com" />
        <link rel="dns-prefetch" href="https://js.stripe.com" />

        {/* iOS tags — sin estos, en iPhone la PWA arranca con barrita
            de Safari y status bar blanco. Con estos arranca como app full. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Orvex" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* theme-color match el background del manifest para que no haya
            flash blanco en standalone al cargar. */}
        <meta name="theme-color" content="#050510" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#f8fafc" media="(prefers-color-scheme: light)" />
        <meta name="color-scheme" content="dark light" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.variable} antialiased min-h-screen bg-gray-950`} suppressHydrationWarning>
        <ServiceWorkerRegistrar />
        <RotateScreenManager />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            className: "animate-in slide-in-from-top-2 fade-in duration-200",
            style: {
              background: "var(--color-bg-elevated, #1f2937)",
              color: "var(--color-text-primary, #f9fafb)",
              border: "1px solid var(--color-border-strong, #374151)",
              borderRadius: "10px",
              fontSize: "0.875rem",
              padding: "10px 14px",
              boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)",
            },
            success: { iconTheme: { primary: "var(--color-accent, #22c55e)", secondary: "#f9fafb" } },
            error: { iconTheme: { primary: "var(--color-danger, #ef4444)", secondary: "#f9fafb" } },
          }}
        />
      </body>
    </html>
  )
}
