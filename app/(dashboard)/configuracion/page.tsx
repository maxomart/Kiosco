"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { CreditCard, Users, Store, ChevronRight } from "lucide-react"
import { BUSINESS_TYPES } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Skeleton } from "@/components/ui/Skeleton"
import { ThemePicker } from "@/components/theme/ThemePicker"
import { useTheme } from "@/components/theme/ThemeProvider"

interface TenantConfig {
  name: string
  businessType: string
  phone: string | null
  address: string | null
  taxId: string | null
  email: string | null
  currency: string
  timezone: string
  themeColor: string | null
  themeMode: "dark" | "light" | "auto" | null
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<TenantConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { accent, mode } = useTheme()

  useEffect(() => {
    fetch("/api/configuracion")
      .then(r => r.json())
      .then(d => { setConfig(d.config); setLoading(false) })
  }, [])

  const set = (key: keyof TenantConfig, val: any) =>
    setConfig(c => c ? { ...c, [key]: val } : c)

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    const res = await fetch("/api/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, themeColor: accent, themeMode: mode }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success("Configuración guardada")
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data?.error ?? "No se pudo guardar")
    }
  }

  const sections = [
    { icon: CreditCard, label: "Suscripción y planes", href: "/configuracion/suscripcion", desc: "Gestionar plan, facturación, upgrades" },
    { icon: Users, label: "Usuarios y permisos", href: "/configuracion/usuarios", desc: "Agregar usuarios, roles y accesos" },
  ]

  return (
    <div className="p-6 space-y-8 max-w-3xl animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="text-gray-400 text-sm mt-1">Ajustes del negocio y cuenta</p>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sections.map(s => (
          <Link key={s.href} href={s.href}
            className="flex items-center gap-4 p-4 bg-gray-900 rounded-xl border border-gray-800 hover-lift hover:border-gray-700 group">
            <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center group-hover:bg-accent-soft transition-colors duration-200">
              <s.icon size={18} className="text-gray-400 group-hover:text-accent transition-colors duration-200" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{s.label}</p>
              <p className="text-gray-500 text-xs mt-0.5">{s.desc}</p>
            </div>
            <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
          </Link>
        ))}
      </div>

      {/* Theme picker — works even before initial config loads */}
      <ThemePicker />

      {/* Business info form */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : config && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Store size={18} className="text-accent" />
            <h2 className="text-white font-semibold">Datos del negocio</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Nombre del negocio"
                value={config.name}
                onChange={e => set("name", e.target.value)}
              />
            </div>
            <Select
              label="Tipo de negocio"
              value={config.businessType}
              onChange={e => set("businessType", e.target.value)}
            >
              {BUSINESS_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </Select>
            <Input
              label="Teléfono"
              type="tel"
              value={config.phone || ""}
              onChange={e => set("phone", e.target.value)}
              placeholder="+54 11 1234-5678"
            />
            <Input
              label="CUIT / CUIL"
              value={config.taxId || ""}
              onChange={e => set("taxId", e.target.value)}
              placeholder="20-12345678-9"
            />
            <div className="sm:col-span-2">
              <Input
                label="Dirección"
                value={config.address || ""}
                onChange={e => set("address", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
            <Button onClick={handleSave} loading={saving} size="md">
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
