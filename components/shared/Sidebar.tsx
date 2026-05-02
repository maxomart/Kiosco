"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  Home,
  ShoppingCart,
  Package,
  Receipt,
  BarChart3,
  Users,
  DollarSign,
  TrendingDown,
  Truck,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Lock,
  X,
  Tag,
  Tv,
  Percent,
  Sparkles,
  Wrench,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { canAny, hasFeature, type Permission, type PlanFeature } from "@/lib/permissions"
import type { Plan } from "@/lib/utils"
import { OrvexLogo } from "@/components/shared/OrvexLogo"

interface SidebarProps {
  user: {
    id: string
    name: string
    email: string
    role: string
    tenantId: string | null
    image?: string | null
  }
  plan?: Plan
  logoUrl?: string | null
  brandName?: string | null
}

// Sidebar items declare BOTH role-based permission checks (any of) AND
// optional plan-feature gating. If `feature` is set and the plan doesn't
// unlock it, the item still renders but with a lock icon + paywall hint.
type NavItem = {
  href: string
  label: string
  icon: any
  permissions?: Permission[]   // any-of; undefined means "everyone"
  feature?: PlanFeature        // optional plan gate
}

// Top: lo más usado del día a día. Siempre visible.
const NAV_TOP: NavItem[] = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/pos", label: "POS", icon: ShoppingCart, permissions: ["sales:create"] },
  { href: "/inventario", label: "Inventario", icon: Package, permissions: ["products:read"] },
  { href: "/ventas", label: "Ventas", icon: Receipt, permissions: ["sales:read"] },
  { href: "/caja", label: "Caja", icon: DollarSign, permissions: ["cash:read"] },
  { href: "/clientes", label: "Clientes", icon: Users, permissions: ["clients:read"] },
  { href: "/reportes", label: "Reportes", icon: BarChart3, permissions: ["reports:read"] },
]

// Herramientas: secundarios. Colapsable para no saturar.
const NAV_TOOLS: NavItem[] = [
  { href: "/cargas", label: "Cargas", icon: Truck, permissions: ["recharges:read"], feature: "feature:recharges" },
  { href: "/gastos", label: "Gastos", icon: TrendingDown, permissions: ["expenses:read"], feature: "feature:expenses" },
  { href: "/etiquetas", label: "Etiquetas", icon: Tag, permissions: ["products:read"], feature: "feature:labels" },
  { href: "/pedidos-proveedor", label: "Pedidos a proveedor", icon: Sparkles, permissions: ["recharges:read"], feature: "feature:supplier_orders" },
  { href: "/comisiones", label: "Comisiones", icon: Percent, permissions: ["reports:read"], feature: "feature:commissions" },
  { href: "/tv", label: "Modo TV", icon: Tv, permissions: ["reports:read"], feature: "feature:tv_mode" },
]

const NAV_BOTTOM: NavItem[] = [
  { href: "/configuracion", label: "Configuración", icon: Settings, permissions: ["settings:read"] },
]

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  CASHIER: "Cajero/a",
}

const TOOLS_OPEN_KEY = "orvex:sidebar-tools-open"

export default function Sidebar({ user, plan = "STARTER", logoUrl, brandName }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Auto-expand "Herramientas" si el path actual está adentro
  const isToolsRoute = NAV_TOOLS.some(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/")
  )
  const [toolsOpen, setToolsOpen] = useState<boolean>(isToolsRoute)

  // Restaurar preferencia del user (persistida en localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (isToolsRoute) { setToolsOpen(true); return }
    try {
      const cached = localStorage.getItem(TOOLS_OPEN_KEY)
      if (cached === "1") setToolsOpen(true)
      else if (cached === "0") setToolsOpen(false)
    } catch {}
  }, [isToolsRoute])

  const handleToggleTools = () => {
    setToolsOpen((prev) => {
      const next = !prev
      try { localStorage.setItem(TOOLS_OPEN_KEY, next ? "1" : "0") } catch {}
      return next
    })
  }

  // Filter por permisos. Items plan-gated igual se muestran con candado.
  const filterByPerm = (items: NavItem[]) =>
    items.filter((item) => {
      if (!item.permissions || item.permissions.length === 0) return true
      return canAny(user.role, item.permissions)
    })
  const visibleTop = filterByPerm(NAV_TOP)
  const visibleTools = filterByPerm(NAV_TOOLS)
  const visibleBottom = filterByPerm(NAV_BOTTOM)

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Close mobile sidebar on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" })
  }

  const renderNavLink = ({ href, label, icon: Icon, feature }: NavItem) => {
    const isActive = pathname === href || pathname.startsWith(href + "/")
    const locked = !!feature && !hasFeature(plan, feature)
    const targetHref = locked ? "/configuracion/suscripcion" : href
    const tourId = `nav-${href.replace(/^\//, "")}`
    return (
      <Link
        key={href}
        href={targetHref}
        data-tour={tourId}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
          isActive && !locked
            ? "bg-accent-soft text-accent-foreground"
            : locked
            ? "text-gray-600 hover:text-gray-400 hover:bg-gray-800/40"
            : "text-gray-400 hover:text-gray-100 hover:bg-gray-800/70",
          collapsed && "justify-center px-2"
        )}
        title={
          collapsed
            ? `${label}${locked ? " (Bloqueado · plan superior)" : ""}`
            : locked
            ? "Función bloqueada — Suscribite para desbloquear"
            : undefined
        }
      >
        <span
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full bg-accent transition-all duration-200 ease-out",
            isActive && !locked ? "h-6 opacity-100" : "h-0 opacity-0"
          )}
          aria-hidden
        />
        <Icon
          className={cn(
            "w-4 h-4 flex-shrink-0 transition-colors duration-150",
            isActive && !locked
              ? "text-accent"
              : locked
              ? "text-gray-600 group-hover:text-gray-500"
              : "text-gray-400 group-hover:text-gray-200"
          )}
        />
        {!collapsed && (
          <>
            <span className={cn("flex-1", isActive && !locked && "text-gray-100")}>{label}</span>
            {locked && (
              <Lock className="w-3.5 h-3.5 text-gray-600 group-hover:text-amber-400 transition-colors" />
            )}
          </>
        )}
      </Link>
    )
  }

  const NavContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-5 border-b border-gray-800",
          collapsed && "justify-center px-2"
        )}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={brandName ?? "Logo"}
            className="flex-shrink-0 w-8 h-8 rounded-lg object-cover bg-gray-800"
          />
        ) : (
          <OrvexLogo size={32} className="flex-shrink-0" gradientId="sidebar-logo-grad" />
        )}
        {!collapsed && (
          <span className="text-white font-bold text-lg tracking-tight truncate">
            {brandName?.trim() || "Orvex"}
          </span>
        )}
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto lg:hidden text-gray-400 hover:text-gray-200 p-1 rounded"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {/* TOP — items principales */}
        {visibleTop.map((item) => renderNavLink(item))}

        {/* GRUPO HERRAMIENTAS — colapsable */}
        {visibleTools.length > 0 && (
          <div className="pt-3">
            {/* Toggle del grupo */}
            <button
              onClick={collapsed ? undefined : handleToggleTools}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors",
                "text-gray-500 hover:text-gray-300 hover:bg-gray-800/40",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? "Herramientas" : undefined}
              aria-expanded={toolsOpen}
            >
              <Wrench className="w-4 h-4 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Herramientas</span>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 transition-transform duration-200",
                      toolsOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </>
              )}
            </button>
            {/* Contenido del grupo (visible cuando expandido OR cuando colapsado para no esconder items) */}
            {(toolsOpen || collapsed) && (
              <div className={cn("space-y-0.5", !collapsed && "mt-1 pl-2 border-l border-gray-800/60 ml-3")}>
                {visibleTools.map((item) => renderNavLink(item))}
              </div>
            )}
          </div>
        )}

        {/* BOTTOM — config */}
        {visibleBottom.length > 0 && (
          <div className="pt-3 border-t border-gray-800/60 mt-3">
            {visibleBottom.map((item) => renderNavLink(item))}
          </div>
        )}
      </nav>

      {/* Bottom section: user info + logout */}
      <div className="border-t border-gray-800 p-3 space-y-2">
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0 transition-colors duration-200">
              <span className="text-xs font-semibold text-accent-foreground uppercase">
                {user.name?.charAt(0) ?? user.email.charAt(0)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-100 truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
              <p className="text-xs text-accent font-medium">
                {ROLE_LABELS[user.role] ?? user.role}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-950/40 transition-all duration-150",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Cerrar sesión" : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "hidden lg:flex w-full items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-600 hover:text-gray-400 hover:bg-gray-800/50 transition-all duration-150",
            collapsed && "justify-center px-2"
          )}
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <>
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Colapsar</span>
            </>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobile sidebar (slide-in) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 sidebar-surface border-r border-gray-800 transform transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Navegación principal"
      >
        {NavContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        data-tour="sidebar"
        className={cn(
          "hidden lg:flex flex-col sidebar-surface border-r border-gray-800 transition-all duration-200 ease-in-out flex-shrink-0",
          collapsed ? "w-16" : "w-56"
        )}
        aria-label="Navegación principal"
      >
        {NavContent}
      </aside>

      {/* Mobile hamburger trigger (rendered inside Header, but exposed via context) */}
      {/* We expose a global trigger ref via data attribute for the Header component */}
      <button
        id="sidebar-mobile-trigger"
        className="hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
      />
    </>
  )
}
