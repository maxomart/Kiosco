"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
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
} from "lucide-react"

interface Props {
  user: { name?: string | null; email?: string | null; image?: string | null }
}

export default function AdminNav({ user }: Props) {
  const pathname = usePathname()

  const links = [
    { href: "/admin", label: "Inicio", icon: BarChart3, exact: true },
    { href: "/admin/tenants", label: "Tenants", icon: Building2 },
    { href: "/admin/usuarios", label: "Usuarios", icon: Users },
    { href: "/admin/suscripciones", label: "Suscripciones", icon: CreditCard },
    { href: "/admin/facturas", label: "Facturas", icon: Receipt },
    { href: "/admin/salud", label: "Salud", icon: Activity },
    { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText },
    { href: "/admin/seguridad", label: "Seguridad", icon: Lock },
  ]

  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase()

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800 h-16 px-6 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link href="/admin" className="flex items-center gap-2">
          <Shield size={20} className="text-purple-400" />
          <span className="text-white font-bold tracking-tight">Orvex Admin</span>
        </Link>
        <div className="flex gap-1 overflow-x-auto">
          {links.map(l => {
            const Icon = l.icon
            const active = l.exact
              ? pathname === l.href
              : pathname === l.href || pathname.startsWith(l.href + "/")
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
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

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-300 flex items-center justify-center text-xs font-semibold">
            {initial}
          </div>
          <span className="text-sm text-gray-400">{user.email}</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={14} /> Salir
        </button>
      </div>
    </nav>
  )
}
