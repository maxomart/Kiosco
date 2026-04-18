import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") redirect("/login")
  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">SA</span>
          </div>
          <span className="text-white font-bold">KioscoApp — Super Admin</span>
        </div>
        <span className="text-gray-400 text-sm">{session.user.email}</span>
      </nav>
      <main>{children}</main>
    </div>
  )
}
