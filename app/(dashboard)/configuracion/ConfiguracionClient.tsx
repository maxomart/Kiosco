"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { CreditCard, Users, Store, ChevronRight, MessageCircle, Send, Lock, Image as ImageIcon, Star, Key, Building2, QrCode, FileCheck2 } from "lucide-react"
import { BUSINESS_TYPES, type Plan } from "@/lib/utils"
import { hasFeature } from "@/lib/permissions"
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
  whatsappPhone: string | null
  whatsappLowStockAlerts: boolean
  whatsappDailySummary: boolean
  logoUrl: string | null
  loyaltyEnabled: boolean
  loyaltyPointsPerPeso: number
  loyaltyPointValue: number
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<TenantConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingWa, setTestingWa] = useState(false)
  const [plan, setPlan] = useState<string>("FREE")
  const { accent, mode } = useTheme()

  useEffect(() => {
    fetch("/api/configuracion/suscripcion")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.subscription?.plan) setPlan(d.subscription.plan) })
      .catch(() => {})
  }, [])

  const waUnlocked = plan !== "FREE"
  const logoUnlocked = hasFeature(plan as Plan, "feature:custom_logo")
  const loyaltyUnlocked = hasFeature(plan as Plan, "feature:loyalty")

  const testWhatsapp = async () => {
    setTestingWa(true)
    try {
      const res = await fetch("/api/whatsapp/test", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) toast.success("Mensaje de prueba enviado. Chequeá tu WhatsApp.")
      else toast.error(data?.error ?? "No se pudo enviar")
    } finally {
      setTestingWa(false)
    }
  }

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
    { icon: Key, label: "API keys", href: "/configuracion/api-keys", desc: "Tokens para acceso programático (Business)" },
    { icon: Building2, label: "Multi-tienda", href: "/configuracion/multi-tienda", desc: "Gestionar varias sucursales (Business)" },
    { icon: QrCode, label: "Mercado Pago", href: "/configuracion/mercadopago", desc: "Cobrá con QR desde el POS (Professional+)" },
    { icon: FileCheck2, label: "Facturación AFIP", href: "/configuracion/afip", desc: "Emití facturas A/B/C con CAE (Starter+)" },
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
            className="flex items-center gap-4 p-4 card-glow rounded-xl hover:border-accent/40 group">
            <div className="w-10 h-10 rounded-lg bg-accent-soft border border-accent/20 flex items-center justify-center group-hover:bg-accent group-hover:border-accent transition-colors duration-200">
              <s.icon size={18} className="text-accent group-hover:text-accent-foreground transition-colors duration-200" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{s.label}</p>
              <p className="text-gray-500 text-xs mt-0.5">{s.desc}</p>
            </div>
            <ChevronRight size={16} className="text-gray-600 group-hover:text-accent transition-colors" />
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

      {/* WhatsApp notifications */}
      {config && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-green-400" />
              <h2 className="text-white font-semibold">Notificaciones por WhatsApp</h2>
              {!waUnlocked && (
                <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-medium">
                  <Lock size={10} /> STARTER+
                </span>
              )}
            </div>
          </div>

          {!waUnlocked ? (
            <div className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-300 mb-1">Recibí alertas en tu WhatsApp</p>
              <p className="text-xs text-gray-500 mb-4">Stock bajo, ventas raras, resumen diario. Disponible desde el plan Starter.</p>
              <Link href="/configuracion/suscripcion"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-medium transition">
                Ver planes
              </Link>
            </div>
          ) : (
            <>
              <div>
                <Input
                  label="Tu número de WhatsApp"
                  type="tel"
                  value={config.whatsappPhone || ""}
                  onChange={e => set("whatsappPhone", e.target.value)}
                  placeholder="+5491112345678"
                  hint="Formato internacional con + y código de país. Ej: +54 9 11 1234-5678 → +5491112345678"
                />
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 transition cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-100">Alertas de stock bajo</p>
                    <p className="text-xs text-gray-500 mt-0.5">Cuando un producto baja del mínimo después de una venta.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.whatsappLowStockAlerts}
                    onChange={e => set("whatsappLowStockAlerts", e.target.checked)}
                    className="w-5 h-5 rounded accent-accent flex-shrink-0"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 transition cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-100">Resumen diario de ventas</p>
                    <p className="text-xs text-gray-500 mt-0.5">Cada noche te llega un resumen del día (próximamente).</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.whatsappDailySummary}
                    onChange={e => set("whatsappDailySummary", e.target.checked)}
                    disabled
                    className="w-5 h-5 rounded accent-accent flex-shrink-0 opacity-50"
                  />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-800">
                <Button onClick={handleSave} loading={saving} size="md">
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={testWhatsapp}
                  loading={testingWa}
                  leftIcon={<Send size={14} />}
                  disabled={!config.whatsappPhone}
                >
                  Enviar mensaje de prueba
                </Button>
              </div>

              <p className="text-[11px] text-gray-600 leading-relaxed">
                Para recibir mensajes la primera vez, tenés que enviar el código join al WhatsApp del bot de Twilio (te lo damos en la consola de Twilio).
                Si los mensajes no llegan, fijate de haber configurado <code className="bg-gray-800 px-1 rounded">TWILIO_ACCOUNT_SID</code>,{" "}
                <code className="bg-gray-800 px-1 rounded">TWILIO_AUTH_TOKEN</code> y{" "}
                <code className="bg-gray-800 px-1 rounded">TWILIO_WHATSAPP_FROM</code> en Railway.
              </p>
            </>
          )}
        </div>
      )}

      {/* Logo del negocio */}
      {config && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon size={18} className="text-accent" />
              <h2 className="text-white font-semibold">Logo del negocio</h2>
              {!logoUnlocked && (
                <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-medium">
                  <Lock size={10} /> STARTER+
                </span>
              )}
            </div>
          </div>

          {!logoUnlocked ? (
            <div className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-300 mb-1">Personalizá tu marca</p>
              <p className="text-xs text-gray-500 mb-4">Mostrá tu logo en el sidebar y en los tickets. Disponible desde el plan Starter.</p>
              <Link href="/configuracion/suscripcion"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-medium transition">
                Ver planes
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                {config.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={config.logoUrl} alt="Logo" className="w-14 h-14 rounded-lg object-cover bg-gray-800 border border-gray-700" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-600">
                    <ImageIcon size={20} />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    label="URL del logo"
                    type="url"
                    value={config.logoUrl || ""}
                    onChange={e => set("logoUrl", e.target.value)}
                    placeholder="https://i.imgur.com/tu-logo.png"
                    hint="Subí tu logo a un host (Cloudinary, imgur) y pegá el link acá. Pronto soportamos upload directo."
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-800">
                <Button onClick={handleSave} loading={saving} size="md">
                  {saving ? "Guardando..." : "Guardar logo"}
                </Button>
                {config.logoUrl && (
                  <Button variant="secondary" onClick={() => set("logoUrl", "")}>
                    Sacar logo
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Programa de fidelidad */}
      {config && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star size={18} className="text-yellow-400" />
              <h2 className="text-white font-semibold">Programa de fidelidad</h2>
              {!loyaltyUnlocked && (
                <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-medium">
                  <Lock size={10} /> PROFESSIONAL+
                </span>
              )}
            </div>
            {loyaltyUnlocked && (
              <Link href="/clientes/fidelidad" className="text-xs text-accent hover:underline">Gestionar puntos →</Link>
            )}
          </div>

          {!loyaltyUnlocked ? (
            <div className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-300 mb-1">Fidelizá a tus clientes con puntos</p>
              <p className="text-xs text-gray-500 mb-4">Acumulan puntos en cada compra y los canjean por descuentos. Disponible desde el plan Professional.</p>
              <Link href="/configuracion/suscripcion"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-medium transition">
                Ver planes
              </Link>
            </div>
          ) : (
            <>
              <label className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 transition cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-100">Activar programa de fidelidad</p>
                  <p className="text-xs text-gray-500 mt-0.5">Las ventas con cliente asignado acumulan puntos automáticamente.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.loyaltyEnabled}
                  onChange={e => set("loyaltyEnabled", e.target.checked)}
                  className="w-5 h-5 rounded accent-accent flex-shrink-0"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Puntos por peso gastado"
                  type="number"
                  step="0.01"
                  min="0"
                  value={config.loyaltyPointsPerPeso}
                  onChange={e => set("loyaltyPointsPerPeso", Number(e.target.value))}
                  hint="Tu cliente acumula X puntos por cada $1 de compra."
                />
                <Input
                  label="Valor de cada punto en pesos"
                  type="number"
                  step="0.01"
                  min="0"
                  value={config.loyaltyPointValue}
                  onChange={e => set("loyaltyPointValue", Number(e.target.value))}
                  hint="Para canjear, cada punto vale $X."
                />
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
                <Button onClick={handleSave} loading={saving} size="md">
                  {saving ? "Guardando..." : "Guardar fidelidad"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
