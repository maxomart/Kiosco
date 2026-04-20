"use client"

import { useState, useEffect } from "react"
import { Building2, Users, DollarSign, TrendingUp, Activity, Crown, AlertCircle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"

interface AdminStats {
  totalTenants: number
  activeTenants: number
  trialingTenants: number
  totalUsers: number
  totalRevenue: number
  monthlyRecurringRevenue: number
  byPlan: { plan: string; count: number }[]
  byBusinessType: { type: string; count: number }[]
  recentSignups: { id: string; name: string; plan: string; createdAt: string }[]
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "#6b7280", STARTER: "#3b82f6", PROFESSIONAL: "#8b5cf6", BUSINESS: "#f59e0b", ENTERPRISE: "#10b981",
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-900 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!stats) return <div className="p-6 text-gray-500">Error al cargar</div>

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Panel de administración</h1>
        <p className="text-gray-400 text-sm mt-1">Métricas generales del SaaS</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">Tenants totales</span>
            <Building2 size={16} className="text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalTenants}</p>
          <p className="text-green-400 text-xs mt-1">{stats.activeTenants} activos · {stats.trialingTenants} en prueba</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">Usuarios totales</span>
            <Users size={16} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
          <p className="text-gray-500 text-xs mt-1">En todas las cuentas</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">MRR</span>
            <DollarSign size={16} className="text-green-400" />
          </div>
          <p className="text-2xl font-bold text-green-400">${stats.monthlyRecurringRevenue.toFixed(0)}</p>
          <p className="text-gray-500 text-xs mt-1">USD / mes recurrente</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">ARR proyectado</span>
            <TrendingUp size={16} className="text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-yellow-400">${(stats.monthlyRecurringRevenue * 12).toFixed(0)}</p>
          <p className="text-gray-500 text-xs mt-1">USD / año recurrente</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h3 className="text-white font-semibold mb-4">Tenants por plan</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stats.byPlan} dataKey="count" nameKey="plan" cx="50%" cy="50%"
                innerRadius={55} outerRadius={85} paddingAngle={2} label>
                {stats.byPlan.map((p, i) => <Cell key={i} fill={PLAN_COLORS[p.plan] || "#6b7280"} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h3 className="text-white font-semibold mb-4">Por tipo de negocio</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.byBusinessType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="type" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px" }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent signups */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h3 className="text-white font-semibold mb-4">Altas recientes</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800">
              <th className="pb-3 text-left font-medium">Negocio</th>
              <th className="pb-3 text-left font-medium">Plan</th>
              <th className="pb-3 text-left font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {stats.recentSignups.map(t => (
              <tr key={t.id}>
                <td className="py-2.5 text-white">{t.name}</td>
                <td className="py-2.5">
                  <span className="px-2 py-0.5 rounded-full text-xs"
                    style={{ backgroundColor: (PLAN_COLORS[t.plan] || "#6b7280") + "20", color: PLAN_COLORS[t.plan] || "#9ca3af" }}>
                    {t.plan}
                  </span>
                </td>
                <td className="py-2.5 text-gray-400">{new Date(t.createdAt).toLocaleDateString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
