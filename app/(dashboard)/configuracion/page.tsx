"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { CreditCard, Users, Store, ChevronRight, Loader2 } from "lucide-react"
import { BUSINESS_TYPES } from "@/lib/utils"

interface TenantConfig {
  name: string
  businessType: string
  phone: string | null
  address: string | null
  taxId: string | null
  email: string | null
  currency: string
  timezone: string
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<TenantConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/configuracion")
      .then(r => r.json())
      .then(d => { setConfig(d.config); setLoading(false) })
  }, [])

  const set = (key: string, val: any) => setConfig(c => c ? { ...c, [key]: val } : c)

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    const res = await fetch("/api/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    })
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    setSaving(false)
  }

  const sections = [
    { icon: CreditCard, label: "Suscripción y planes", href: "/configuracion/suscripcion", desc: "Gestionar plan, facturación, upgrades" },
    { icon: Users, label: "Usuarios y permisos", href: "/configuracion/usuarios", desc: "Agregar usuarios, roles y accesos" },
  ]

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="text-gray-400 text-sm mt-1">Ajustes del negocio y cuenta</p>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sections.map(s => (
          <Link key={s.href} href={s.href}
            className="flex items-center gap-4 p-4 bg-gray-900 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors group">
            <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center group-hover:bg-purple-600/20 transition-colors">
              <s.icon size={18} className="text-gray-400 group-hover:text-purple-400 transition-colors" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{s.label}</p>
              <p className="text-gray-500 text-xs mt-0.5">{s.desc}</p>
            </div>
            <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
          </Link>
        ))}
      </div>

      {/* Business info form */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-800 rounded-lg" />
          ))}
        </div>
      ) : config && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Store size={18} className="text-purple-400" />
            <h2 className="text-white font-semibold">Datos del negocio</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">Nombre del negocio</label>
              <input value={config.name} onChange={e => set("name", e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Tipo de negocio</label>
              <select value={config.businessType} onChange={e => set("businessType", e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500">
                {BUSINESS_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Teléfono</label>
              <input type="tel" value={config.phone || ""} onChange={e => set("phone", e.target.value)}
                placeholder="+54 11 1234-5678"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">CUIT / CUIL</label>
              <input value={config.taxId || ""} onChange={e => set("taxId", e.target.value)}
                placeholder="20-12345678-9"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">Dirección</label>
              <input value={config.address || ""} onChange={e => set("address", e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            {saved && <span className="text-green-400 text-sm">¡Guardado!</span>}
          </div>
        </div>
      )}
    </div>
  )
}
