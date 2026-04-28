"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { useState, useRef, useEffect } from "react"
import {
  Shield,
  LogOut,
  Building2,
  BarChart3,
  Users,
  CreditCard,
  Receipt,
  ScrollText,
  Activity,
  Lock,
  LifeBuoy,
  FileSpreadsheet,
  ChevronDown,
} from "lucide-react"

interface Props {
  user: { name?: string | null; email?: string | null; image?: string | null }
}

export default function AdminNav({ user }: Props) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const links = [
    { href: "/admin", label: "Inicio", icon: BarChart3, exact: true },
    { href: "/admin/tenants", label: "Tenants", icon: Building2 },
    { href: "/admin/usuarios", label: "Usuarios", icon: Users },
    { href: "/admin/suscripciones", label: "Suscripciones", icon: CreditCard },
    { href: "/admin/facturas", label: "Facturas", icon: Receipt },
    { href: "/admin/exportar", label: "Exportar", icon: FileSpreadsheet },
    { href: "/admin/soporte", label: "Soporte", icon: LifeBuoy },
    { href: "/admin/salud", label: "Salud", icon: Activity },
    { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText },
    { href: "/admin/seguridad", label: "Seguridad", icon: Lock },
  ]

  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase()

  // Cerrar dropdown al clickear afuera o presionar Esc
  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onEsc)
    }
  }, [menuOpen])

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800 h-16 px-4 lg:px-6 flex items-center gap-4">
      {/* Logo: nunca se achica */}
      <Link href="/admin" className="flex items-center gap-2 flex-shrink-0">
        <Shield size={20} className="text-purple-400" />
        <span className="text-white font-bold tracking-tight hidden sm:inline">Orvex Admin</span>
      </Link>

      {/* Links: scrollean horizontal si no entran. min-w-0 permite que el flex hijo
          pueda achicarse (sin esto el overflow no toma efecto). */}
      <div className="flex-1 min-w-0">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {links.map((l) => {
            const Icon = l.icon
            const active = l.exact
              ? pathname === l.href
              : pathname === l.href || pathname.startsWith(l.href + "/")
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors flex-shrink-0 ${
                  active
                    ? "bg-purple-600/20 text-purple-300"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <Icon size={14} /> {l.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* User menu: nunca se achica, abre dropdown con "Salir" adentro */}
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-300 flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {initial}
          </div>
          <ChevronDown size={14} className={`text-gray-500 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 w-60 bg-gray-900 border border-gray-800 rounded-xl shadow-xl shadow-black/40 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-800">
              <p className="text-sm text-white font-medium truncate">{user.name ?? "Admin"}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                signOut({ callbackUrl: "/login" })
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              role="menuitem"
            >
              <LogOut size={14} /> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
