"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { PLAN_LABELS } from "@/lib/utils"
import type { Plan } from "@/lib/utils"
import NotificationsBell from "@/components/shared/NotificationsBell"

interface HeaderProps {
  user: {
    id: string
    name: string
    email: string
    role: string
    tenantId: string | null
    image?: string | null
  }
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Inicio",
  "/pos": "Punto de Venta",
  "/inventario": "Inventario",
  "/ventas": "Ventas",
  "/reportes": "Reportes",
  "/clientes": "Clientes",
  "/caja": "Caja",
  "/gastos": "Gastos",
  "/cargas": "Cargas",
  "/configuracion": "Configuración",
}

const PLAN_COLORS: Record<Plan, string> = {
  FREE: "bg-gray-700 text-gray-300",
  STARTER: "bg-blue-900/60 text-blue-300 border border-blue-700/50",
  PROFESSIONAL: "bg-accent-soft text-accent border border-accent/40",
  BUSINESS: "bg-amber-900/60 text-amber-300 border border-amber-700/50",
  ENTERPRISE: "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50",
}

function getPageTitle(pathname: string): string {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // Match by prefix (e.g. /ventas/123 → "Ventas")
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (path !== "/" && pathname.startsWith(path + "/")) return title
  }
  return "RetailAR"
}

function openMobileSidebar() {
  const btn = document.getElementById("sidebar-mobile-trigger")
  btn?.click()
}

export default function Header({ user }: HeaderProps) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const main = document.querySelector("main")
    if (!main) return
    const onScroll = () => setScrolled(main.scrollTop > 4)
    main.addEventListener("scroll", onScroll, { passive: true })
    return () => main.removeEventListener("scroll", onScroll)
  }, [])

  // Plan is stored in session user — for now we read from the role/name
  // In a real scenario this would come from a context or be passed as a prop.
  // We use FREE as a safe default; the dashboard page will enrich this via fetch.
  const plan: Plan = "FREE"

  const initials = (user.name ?? user.email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <header
      className={cn(
        "h-14 flex items-center px-4 gap-3 flex-shrink-0 sticky top-0 z-30",
        "bg-gray-900/85 backdrop-blur-md border-b transition-all duration-200",
        scrolled
          ? "border-gray-700/80 shadow-lg shadow-black/30"
          : "border-gray-800"
      )}
    >
      {/* Mobile hamburger */}
      <button
        onClick={openMobileSidebar}
        className="lg:hidden p-1.5 rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
        aria-label="Abrir menú lateral"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title */}
      <h1 className="text-gray-100 font-semibold text-base truncate flex-1">
        {title}
      </h1>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Subscription plan badge */}
        <span
          className={cn(
            "hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
            PLAN_COLORS[plan]
          )}
        >
          {PLAN_LABELS[plan]}
        </span>

        {/* Notification bell — fully functional */}
        <NotificationsBell />

        {/* User avatar */}
        <div className="flex items-center gap-1.5 pl-1">
          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center flex-shrink-0 transition-colors duration-200">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? "Avatar"}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold text-accent-foreground">{initials}</span>
            )}
          </div>
          <span className="hidden md:block text-sm text-gray-300 font-medium max-w-[120px] truncate">
            {user.name}
          </span>
          <ChevronDown className="hidden md:block w-3.5 h-3.5 text-gray-500" />
        </div>
      </div>
    </header>
  )
}
