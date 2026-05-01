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
  Clock,
  Bot,
  Settings,
  UsersRound,
} from "lucide-react"

interface Props {
  user: { name?: string | null; email?: string | null; image?: string | null }
}

interface NavLink {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
  description?: string
}

interface NavGroup {
  type: "group"
  label: string
  icon: React.ElementType
  links: NavLink[]
}

interface NavItem extends NavLink {
  type: "link"
}

type NavEntry = NavItem | NavGroup

// Estructura nueva: 5 entradas top-level — items críticos como link directo
// y los demás agrupados por contexto (Cuentas, Sistema).
const NAV: NavEntry[] = [
  { type: "link", href: "/admin", label: "Inicio", icon: BarChart3, exact: true },
  {
    type: "group",
    label: "Cuentas",
    icon: UsersRound,
    links: [
      { href: "/admin/tenants", label: "Tenants", icon: Building2, description: "Comercios suscriptos" },
      { href: "/admin/usuarios", label: "Usuarios", icon: Users, description: "Cuentas individuales" },
      { href: "/admin/suscripciones", label: "Suscripciones", icon: CreditCard, description: "Planes y renovaciones" },
      { href: "/admin/facturas", label: "Facturas", icon: Receipt, description: "Cobros y emisiones" },
    ],
  },
  { type: "link", href: "/admin/soporte", label: "Soporte", icon: LifeBuoy },
  {
    type: "group",
    label: "Sistema",
    icon: Settings,
    links: [
      { href: "/admin/salud", label: "Salud", icon: Activity, description: "Métricas del servidor" },
      { href: "/admin/cron", label: "Cron", icon: Clock, description: "Jobs programados" },
      { href: "/admin/bot", label: "Bot", icon: Bot, description: "Simulador de cuenta demo" },
      { href: "/admin/exportar", label: "Exportar", icon: FileSpreadsheet, description: "Sync con Google Sheets" },
      { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText, description: "Log de acciones críticas" },
    ],
  },
  { type: "link", href: "/admin/seguridad", label: "Seguridad", icon: Lock },
]

export default function AdminNav({ user }: Props) {
  const pathname = usePathname()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const groupMenuRef = useRef<HTMLDivElement>(null)

  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase()

  // Click fuera / Esc cierra cualquier menu abierto
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setOpenGroup(null)
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUserMenuOpen(false)
        setOpenGroup(null)
      }
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onEsc)
    }
  }, [])

  const isLinkActive = (l: NavLink) =>
    l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/")

  const isGroupActive = (g: NavGroup) => g.links.some((l) => isLinkActive(l))

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800 h-16 px-4 lg:px-6 flex items-center gap-4">
      {/* Logo: nunca se achica */}
      <Link href="/admin" className="flex items-center gap-2 flex-shrink-0">
        <Shield size={20} className="text-purple-400" />
        <span className="text-white font-bold tracking-tight hidden sm:inline">Orvex Admin</span>
      </Link>

      {/* Nav top-level — overflow-visible para que los dropdowns no queden
          clipeados. Si no entran en mobile (5 items + iconos), usamos
          flex-wrap antes de cortar. */}
      <div className="flex-1 min-w-0" ref={groupMenuRef}>
        <div className="flex gap-1 flex-wrap">
          {NAV.map((entry) => {
            const Icon = entry.icon
            if (entry.type === "link") {
              const active = isLinkActive(entry)
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors flex-shrink-0 ${
                    active
                      ? "bg-purple-600/20 text-purple-300"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  <Icon size={14} /> {entry.label}
                </Link>
              )
            }
            // Group con dropdown
            const active = isGroupActive(entry)
            const open = openGroup === entry.label
            return (
              <div key={entry.label} className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenGroup(open ? null : entry.label)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    active || open
                      ? "bg-purple-600/20 text-purple-300"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                  aria-haspopup="menu"
                  aria-expanded={open}
                >
                  <Icon size={14} /> {entry.label}
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>

                {open && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full mt-2 w-64 bg-gray-900 border border-gray-800 rounded-xl shadow-xl shadow-black/50 overflow-hidden"
                  >
                    {entry.links.map((sub) => {
                      const SubIcon = sub.icon
                      const subActive = isLinkActive(sub)
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setOpenGroup(null)}
                          role="menuitem"
                          className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${
                            subActive
                              ? "bg-purple-600/15 text-purple-200"
                              : "text-gray-300 hover:bg-gray-800 hover:text-white"
                          }`}
                        >
                          <SubIcon size={15} className="flex-shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight">{sub.label}</p>
                            {sub.description && (
                              <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                                {sub.description}
                              </p>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* User menu */}
      <div className="relative flex-shrink-0" ref={userMenuRef}>
        <button
          type="button"
          onClick={() => setUserMenuOpen((v) => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
        >
          <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-300 flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {initial}
          </div>
          <ChevronDown
            size={14}
            className={`text-gray-500 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
          />
        </button>

        {userMenuOpen && (
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
                setUserMenuOpen(false)
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
