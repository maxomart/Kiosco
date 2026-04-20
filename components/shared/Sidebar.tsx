"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
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
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  user: {
    id: string
    name: string
    email: string
    role: string
    tenantId: string | null
    image?: string | null
  }
}

const NAV_ITEMS = [
  { href: "/pos", label: "POS", icon: ShoppingCart },
  { href: "/inventario", label: "Inventario", icon: Package },
  { href: "/ventas", label: "Ventas", icon: Receipt },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/caja", label: "Caja", icon: DollarSign },
  { href: "/gastos", label: "Gastos", icon: TrendingDown },
  { href: "/cargas", label: "Cargas", icon: Truck },
  { href: "/configuracion", label: "Configuración", icon: Settings },
] as const

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  CASHIER: "Cajero/a",
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

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

  const NavContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-5 border-b border-gray-800",
          collapsed && "justify-center px-2"
        )}
      >
        <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
          <ShoppingBag className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="text-white font-bold text-lg tracking-tight">
            RetailAR
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
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/30"
                  : "text-gray-400 hover:text-gray-100 hover:bg-gray-800",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  isActive ? "text-white" : "text-gray-400 group-hover:text-gray-200"
                )}
              />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section: user info + logout */}
      <div className="border-t border-gray-800 p-3 space-y-2">
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-white uppercase">
                {user.name?.charAt(0) ?? user.email.charAt(0)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-100 truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
              <p className="text-xs text-purple-400 font-medium">
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
          "fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Navegación principal"
      >
        {NavContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-200 ease-in-out flex-shrink-0",
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
