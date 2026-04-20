"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ShoppingBag,
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  Truck,
  Smartphone,
  DollarSign,
  Settings,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  roles: string[]
  color: string
}

const navItems: NavItem[] = [
  { href: "/pos", icon: ShoppingCart, label: "Caja / POS", roles: ["ADMIN", "OWNER", "CASHIER"], color: "text-green-400" },
  { href: "/inventario", icon: Package, label: "Inventario", roles: ["ADMIN", "OWNER"], color: "text-blue-400" },
  { href: "/stock-masivo", icon: Layers, label: "Stock Masivo", roles: ["ADMIN", "OWNER"], color: "text-cyan-400" },
  { href: "/cargas", icon: Smartphone, label: "Cargas/Recargas", roles: ["ADMIN", "OWNER", "CASHIER"], color: "text-purple-400" },
  { href: "/caja", icon: DollarSign, label: "Gestión de Caja", roles: ["ADMIN", "OWNER"], color: "text-yellow-400" },
  { href: "/gastos", icon: Receipt, label: "Gastos", roles: ["ADMIN", "OWNER"], color: "text-red-400" },
  { href: "/clientes", icon: Users, label: "Clientes", roles: ["ADMIN", "OWNER"], color: "text-sky-400" },
  { href: "/proveedores", icon: Truck, label: "Proveedores", roles: ["ADMIN", "OWNER"], color: "text-orange-400" },
  { href: "/reportes", icon: BarChart3, label: "Reportes", roles: ["ADMIN", "OWNER"], color: "text-indigo-400" },
  { href: "/configuracion", icon: Settings, label: "Configuración", roles: ["ADMIN", "OWNER"], color: "text-gray-400" },
]

interface SidebarProps {
  role: string
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const filteredItems = navItems.filter((item) => item.roles.includes(role))

  return (
    <aside
      className={cn(
        "flex flex-col transition-all duration-300 relative sidebar-surface",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-white/5",
        collapsed && "justify-center px-2"
      )}>
        <div
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center brand-glow"
          style={{
            background:
              "linear-gradient(135deg, rgb(var(--glow-primary)), rgb(var(--glow-secondary)))",
          }}
        >
          <ShoppingBag size={20} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-sm text-white">KioscoApp</p>
            <p className="text-gray-500 text-xs">Sistema de Gestión</p>
          </div>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {filteredItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative",
                active
                  ? "bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-100",
                collapsed && "justify-center"
              )}
              style={active ? {
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(var(--glow-primary) / 0.2)",
              } : undefined}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                size={20}
                className={cn(
                  "flex-shrink-0 transition-colors",
                  active ? item.color : "text-gray-500 group-hover:text-gray-300"
                )}
              />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
              {active && !collapsed && (
                <div className={cn("ml-auto w-1.5 h-1.5 rounded-full", item.color.replace("text-", "bg-"))} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Botón colapsar */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 bg-[#131322] border border-white/10 rounded-full flex items-center justify-center text-gray-300 hover:text-white hover:border-purple-400/60 transition shadow-md z-20"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-white/5">
          <p className="text-gray-500 text-xs text-center">v0.1.0 · Argentina 🇦🇷</p>
        </div>
      )}
    </aside>
  )
}
