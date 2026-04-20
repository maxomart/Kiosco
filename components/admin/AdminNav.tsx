"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Shield, LogOut, Building2, BarChart3, Activity } from "lucide-react"

interface Props {
  user: { name?: string | null; email?: string | null }
}

export default function AdminNav({ user }: Props) {
  const pathname = usePathname()

  const links = [
    { href: "/admin", label: "Dashboard", icon: BarChart3 },
    { href: "/admin/tenants", label: "Tenants", icon: Building2 },
    { href: "/admin/metrics", label: "Métricas", icon: Activity },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-gray-900 border-b border-gray-800 h-16 px-6 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link href="/admin" className="flex items-center gap-2">
          <Shield size={20} className="text-purple-400" />
          <span className="text-white font-bold">RetailAR Admin</span>
        </Link>
        <div className="flex gap-1">
          {links.map(l => {
            const Icon = l.icon
            const active = pathname === l.href || (l.href !== "/admin" && pathname.startsWith(l.href))
            return (
              <Link key={l.href} href={l.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  active ? "bg-purple-600/20 text-purple-300" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}>
                <Icon size={14} /> {l.label}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">{user.email}</span>
        <button onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <LogOut size={14} /> Salir
        </button>
      </div>
    </nav>
  )
}
