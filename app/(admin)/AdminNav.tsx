"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

export default function AdminNav({ email }: { email: string }) {
  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold">SA</span>
        </div>
        <span className="text-white font-bold">KioscoApp — Super Admin</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-gray-400 text-sm hidden sm:block">{email}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-xl transition text-sm"
          title="Cerrar sesión"
        >
          <LogOut size={16} />
          <span className="hidden sm:block">Salir</span>
        </button>
      </div>
    </nav>
  )
}
