import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "react-hot-toast"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: { default: "RetailAR - Sistema de Gestión", template: "%s | RetailAR" },
  description: "Sistema de gestión para negocios retail argentinos: kioscos, farmacias, verdulerías y minisúper",
  manifest: "/manifest.json",
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "RetailAR - Sistema de Gestión para Negocios",
    description: "POS, inventario y reportes para kioscos, farmacias y minisúper",
    locale: "es_AR",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#030712",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" suppressHydrationWarning className="dark">
      <head />
      <body className={`${inter.variable} antialiased min-h-screen bg-gray-950`} suppressHydrationWarning>
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
