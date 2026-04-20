"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  ChevronDown,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  Sparkles,
  UserCircle,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { cn, PLAN_LABELS } from "@/lib/utils"
import type { Plan } from "@/lib/utils"
import NotificationsBell from "@/components/shared/NotificationsBell"

interface HeaderProps {
  plan?: Plan
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
  FREE: "bg-gray-800/80 text-gray-300 border border-gray-700/60",
  STARTER: "bg-accent-soft text-accent border border-accent/40",
  PROFESSIONAL: "bg-accent-soft text-accent border border-accent/40",
  BUSINESS: "bg-amber-900/60 text-amber-300 border border-amber-700/50",
  ENTERPRISE: "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50",
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (path !== "/" && pathname.startsWith(path + "/")) return title
  }
  return "RetailAR"
}

function openMobileSidebar() {
  const btn = document.getElementById("sidebar-mobile-trigger")
  btn?.click()
}

export default function Header({ user, plan: planProp = "FREE" }: HeaderProps) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const main = document.querySelector("main")
    if (!main) return
    const onScroll = () => setScrolled(main.scrollTop > 4)
    main.addEventListener("scroll", onScroll, { passive: true })
    return () => main.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const plan: Plan = planProp

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
        "backdrop-blur-md border-b transition-all duration-200",
        scrolled
          ? "border-gray-700/80 shadow-lg shadow-black/30"
          : "border-white/5",
        "relative"
      )}
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--color-accent) 5%, rgb(17 24 39 / 0.90)) 0%, rgb(17 24 39 / 0.85) 100%)",
      }}
    >
      <button
        onClick={openMobileSidebar}
        className="lg:hidden p-1.5 rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
        aria-label="Abrir menú lateral"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="text-gray-100 font-semibold text-base truncate flex-1">
        {title}
      </h1>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
            PLAN_COLORS[plan]
          )}
        >
          {PLAN_LABELS[plan]}
        </span>

        <NotificationsBell />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              "flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full",
              "hover:bg-white/5 transition-colors",
              menuOpen && "bg-white/5"
            )}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
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
            <span className="hidden md:block text-sm text-gray-200 font-medium max-w-[120px] truncate">
              {user.name}
            </span>
            <ChevronDown
              className={cn(
                "hidden md:block w-3.5 h-3.5 text-gray-400 transition-transform duration-200",
                menuOpen && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "absolute right-0 mt-2 w-64 rounded-xl overflow-hidden",
                  "bg-gray-950/95 backdrop-blur-xl border border-gray-800 shadow-2xl z-50"
                )}
              >
                <div className="px-4 py-3 border-b border-gray-800">
                  <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{user.email}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
                        PLAN_COLORS[plan]
                      )}
                    >
                      <Sparkles size={9} /> {PLAN_LABELS[plan]}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">
                      {user.role === "OWNER"
                        ? "Dueño"
                        : user.role === "ADMIN"
                        ? "Admin"
                        : "Cajero"}
                    </span>
                  </div>
                </div>
                <div className="p-1.5">
                  <MenuLink
                    href="/configuracion"
                    icon={<UserCircle size={15} />}
                    label="Mi perfil y negocio"
                  />
                  <MenuLink
                    href="/configuracion/suscripcion"
                    icon={<Sparkles size={15} />}
                    label="Suscripción y plan"
                  />
                  <MenuLink
                    href="/configuracion/usuarios"
                    icon={<SettingsIcon size={15} />}
                    label="Usuarios y permisos"
                  />
                </div>
                <div className="p-1.5 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-300 hover:bg-red-500/10 transition-colors"
                    role="menuitem"
                  >
                    <LogOut size={15} />
                    Cerrar sesión
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

function MenuLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-white/5 hover:text-white transition-colors"
    >
      <span className="text-gray-400">{icon}</span>
      {label}
    </Link>
  )
}
