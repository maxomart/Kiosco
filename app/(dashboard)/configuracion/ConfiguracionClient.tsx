"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { CreditCard, Users, Store, ChevronRight, MessageCircle, Send, Lock, Image as ImageIcon, Star, Building2, QrCode, FileCheck2, Keyboard, Settings, Sparkles, Crown, Mail, AlertTriangle, CalendarDays, CalendarRange, Calendar as CalendarIcon } from "lucide-react"
import { PageTip } from "@/components/shared/PageTip"
import { BUSINESS_TYPES, type Plan } from "@/lib/utils"
import { hasFeature } from "@/lib/permissions"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Skeleton } from "@/components/ui/Skeleton"
import { ThemePicker } from "@/components/theme/ThemePicker"
import { SurfacePicker } from "@/components/theme/SurfacePicker"
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
  // Email notifications
  notificationEmail: string | null
  emailLowStockAlerts: boolean
  emailDailySummary: boolean
  emailWeeklySummary: boolean
  emailMonthlySummary: boolean
  emailIncludeAIInsights: boolean
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
  const [plan, setPlan] = useState<string>("STARTER")
  const [themeAutoSaving, setThemeAutoSaving] = useState(false)
  const [themeJustSaved, setThemeJustSaved] = useState(false)
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

  // Auto-save theme changes (color + mode) with debounce
  // Skip the initial render so we don't fire a save before the user touches anything.
  const initialThemeRef = (typeof window !== "undefined" ? (window as any).__themeInitial : null) as { accent: string; mode: string } | null
  useEffect(() => {
    if (loading || !config) return
    // Snapshot initial values once we have them, to compare against later changes
    if (!initialThemeRef) {
      ;(window as any).__themeInitial = { accent, mode }
      return
    }
    if (initialThemeRef.accent === accent && initialThemeRef.mode === mode) return

    let cancelled = false
    setThemeAutoSaving(true)
    setThemeJustSaved(false)

    const timeoutId = window.setTimeout(async () => {
      if (cancelled) return
      try {
        const res = await fetch("/api/configuracion", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...config, themeColor: accent, themeMode: mode }),
        })
        if (res.ok) {
          ;(window as any).__themeInitial = { accent, mode }
          setThemeJustSaved(true)
          window.setTimeout(() => setThemeJustSaved(false), 2000)
        } else {
          toast.error("No se pudo guardar el tema")
        }
      } catch {
        toast.error("Error de red guardando tema")
      } finally {
        if (!cancelled) setThemeAutoSaving(false)
      }
    }, 600)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, mode, loading])

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
    { icon: CreditCard, label: "Suscripción y planes", href: "/configuracion/suscripcion", desc: "Plan actual, facturación, upgrades", color: "text-accent", bg: "bg-accent-soft", border: "border-accent/30" },
    { icon: Users, label: "Usuarios y permisos", href: "/configuracion/usuarios", desc: "Agregar usuarios y roles", color: "text-sky-400", bg: "bg-sky-900/40", border: "border-sky-700/40" },
    { icon: Keyboard, label: "Atajos de teclado", href: "/configuracion/atajos", desc: "Personalizar F1, F2, etc.", color: "text-emerald-400", bg: "bg-emerald-900/40", border: "border-emerald-700/40" },
    { icon: QrCode, label: "Mercado Pago", href: "/configuracion/mercadopago", desc: "Cobrá con QR desde el POS", color: "text-cyan-400", bg: "bg-cyan-900/40", border: "border-cyan-700/40", requiredPlan: "PROFESSIONAL" as const },
    { icon: FileCheck2, label: "Facturación AFIP", href: "/configuracion/afip", desc: "Emití facturas A/B/C con CAE", color: "text-amber-400", bg: "bg-amber-900/40", border: "border-amber-700/40", requiredPlan: "STARTER" as const },
    { icon: Building2, label: "Multi-tienda", href: "/configuracion/multi-tienda", desc: "Gestionar varias sucursales", color: "text-purple-400", bg: "bg-purple-900/40", border: "border-purple-700/40", requiredPlan: "BUSINESS" as const },
  ]

  // Plan helpers
  const PLAN_LABELS: Record<string, string> = { FREE: "Gratis", STARTER: "Básico", PROFESSIONAL: "Profesional", BUSINESS: "Negocio", ENTERPRISE: "Enterprise" }
  const planLabel = PLAN_LABELS[plan] ?? plan
  const planRank: Record<string, number> = { FREE: 0, STARTER: 1, PROFESSIONAL: 2, BUSINESS: 3, ENTERPRISE: 4 }
  const isLocked = (req?: "STARTER" | "PROFESSIONAL" | "BUSINESS") => req && planRank[plan] < planRank[req]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <PageTip id="configuracion:intro" tone="accent">
        Acá personalizás tu negocio, agregás usuarios, configurás cobros con MP/AFIP y ajustás los atajos de teclado.
        Cada cambio se guarda al toque.
      </PageTip>

      {/* Header with plan info */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center flex-shrink-0">
            <Settings className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Configuración</h1>
            <p className="text-gray-400 text-sm mt-1">
              {config?.name ? <><strong className="text-gray-200">{config.name}</strong> · </> : ""}
              Ajustes del negocio y cuenta
            </p>
          </div>
        </div>
        <Link
          href="/configuracion/suscripcion"
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-900/30 to-amber-900/10 border border-amber-700/40 text-amber-300 text-sm hover:from-amber-900/50 transition-colors"
        >
          <Crown className="w-4 h-4" />
          Plan: <strong>{planLabel}</strong>
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Quick nav cards with locks */}
      <div>
        <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Secciones</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {sections.map(s => {
            const locked = isLocked(s.requiredPlan)
            return (
              <Link
                key={s.href}
                href={locked ? "/configuracion/suscripcion" : s.href}
                className={`group relative overflow-hidden flex items-start gap-3 p-4 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.99] ${
                  locked
                    ? "bg-gray-900/40 border-gray-800 hover:border-amber-700/50"
                    : "bg-gray-900 border-gray-800 hover:border-gray-700"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg ${s.bg} border ${s.border} flex items-center justify-center flex-shrink-0`}>
                  <s.icon size={18} className={s.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-white text-sm font-medium truncate">{s.label}</p>
                    {locked && <Lock size={11} className="text-amber-400 flex-shrink-0" />}
                  </div>
                  <p className="text-gray-500 text-[11px] mt-0.5 line-clamp-2">{s.desc}</p>
                  {locked && (
                    <p className="text-[10px] text-amber-400 mt-1 font-medium">
                      Requiere plan {PLAN_LABELS[s.requiredPlan!]}+
                    </p>
                  )}
                </div>
                <ChevronRight size={14} className="text-gray-600 group-hover:text-accent transition-colors flex-shrink-0 mt-1" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* Two-column layout on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ── Left column: forms ── */}
        <div className="space-y-6">
          {/* Business info */}
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : config && (
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-5">
              <div className="flex items-start gap-3 pb-2 border-b border-gray-800/60">
                <div className="w-9 h-9 rounded-lg bg-accent-soft border border-accent/30 flex items-center justify-center flex-shrink-0">
                  <Store size={16} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-white font-semibold">Datos del negocio</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Información que aparece en tickets, facturas y reportes</p>
                </div>
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

          {/* Email notifications */}
          {config && (
            <EmailNotificationsSection
              config={config}
              set={set}
              onSave={handleSave}
              saving={saving}
              waUnlocked={waUnlocked}
            />
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

        {/* ── Right column: personalization (sticky on large screens) ── */}
        <div className="space-y-6 lg:sticky lg:top-20">
          {/* Auto-save indicator */}
          {(themeAutoSaving || themeJustSaved) && (
            <div
              className={`text-[11px] px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${
                themeAutoSaving
                  ? "bg-accent-soft/40 border-accent/30 text-accent"
                  : "bg-emerald-900/30 border-emerald-700/40 text-emerald-300"
              }`}
            >
              {themeAutoSaving ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  Guardando tema...
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Tema guardado ✓
                </>
              )}
            </div>
          )}
          <ThemePicker />
          <SurfacePicker />
        </div>

      </div>
    </div>
  )
}

// ============================================================================
// EmailNotificationsSection
// ============================================================================
function EmailNotificationsSection({
  config,
  set,
  onSave,
  saving,
  waUnlocked,
}: {
  config: TenantConfig
  set: (key: keyof TenantConfig, val: any) => void
  onSave: () => Promise<void> | void
  saving: boolean
  waUnlocked: boolean
}) {
  const [testing, setTesting] = useState<null | "daily" | "weekly" | "monthly" | "lowstock">(null)

  const test = async (period: "daily" | "weekly" | "monthly" | "lowstock") => {
    setTesting(period)
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(
          period === "lowstock"
            ? "Email de stock bajo enviado"
            : `Reporte ${period === "daily" ? "diario" : period === "weekly" ? "semanal" : "mensual"} enviado`
        )
      } else {
        toast.error(data?.error ?? "No se pudo enviar el email")
      }
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-5">
      <div className="flex items-start gap-3 pb-2 border-b border-gray-800/60">
        <div className="w-9 h-9 rounded-lg bg-sky-900/40 border border-sky-700/40 flex items-center justify-center flex-shrink-0">
          <Mail size={16} className="text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-white font-semibold">Notificaciones por email</h2>
            {!waUnlocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-medium">
                <Lock size={10} /> STARTER+
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Recibí informes profesionales con el resumen del día, semana o mes a tu correo.
          </p>
        </div>
      </div>

      {!waUnlocked ? (
        <div className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-300 mb-1">Reportes automáticos en tu correo</p>
          <p className="text-xs text-gray-500 mb-4">
            Resumen diario, semanal y mensual con KPIs, top productos, márgenes y análisis con IA.
            Disponible desde el plan Básico.
          </p>
          <Link
            href="/configuracion/suscripcion"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-medium transition"
          >
            Ver planes
          </Link>
        </div>
      ) : (
        <>
          <div>
            <Input
              label="Email para los reportes"
              type="email"
              value={config.notificationEmail || ""}
              onChange={(e) => set("notificationEmail", e.target.value)}
              placeholder="tunegocio@gmail.com"
              hint="Si lo dejás vacío, usamos el email del propietario."
            />
          </div>

          {/* Frequency cards */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">¿Qué querés recibir?</p>

            <FrequencyCard
              icon={<CalendarDays size={16} className="text-sky-400" />}
              iconBg="bg-sky-900/40 border-sky-700/40"
              title="Resumen diario"
              description="Cada noche te llega cómo cerró el día: ventas, ganancia, top productos."
              checked={config.emailDailySummary}
              onChange={(v) => set("emailDailySummary", v)}
              onTest={() => test("daily")}
              testing={testing === "daily"}
              disabled={saving}
            />

            <FrequencyCard
              icon={<CalendarRange size={16} className="text-emerald-400" />}
              iconBg="bg-emerald-900/40 border-emerald-700/40"
              title="Resumen semanal"
              description="Cada lunes a la mañana, qué pasó la semana pasada con comparación."
              checked={config.emailWeeklySummary}
              onChange={(v) => set("emailWeeklySummary", v)}
              onTest={() => test("weekly")}
              testing={testing === "weekly"}
              disabled={saving}
            />

            <FrequencyCard
              icon={<CalendarIcon size={16} className="text-purple-400" />}
              iconBg="bg-purple-900/40 border-purple-700/40"
              title="Resumen mensual"
              description="El primer día de cada mes, balance del mes anterior con análisis profundo."
              checked={config.emailMonthlySummary}
              onChange={(v) => set("emailMonthlySummary", v)}
              onTest={() => test("monthly")}
              testing={testing === "monthly"}
              disabled={saving}
            />

            <FrequencyCard
              icon={<AlertTriangle size={16} className="text-amber-400" />}
              iconBg="bg-amber-900/40 border-amber-700/40"
              title="Alertas de stock bajo"
              description="Cuando un producto baja del mínimo, te avisamos para reponer a tiempo."
              checked={config.emailLowStockAlerts}
              onChange={(v) => set("emailLowStockAlerts", v)}
              onTest={() => test("lowstock")}
              testing={testing === "lowstock"}
              disabled={saving}
            />

            {/* AI insights toggle */}
            <label className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gradient-to-r from-accent-soft/30 to-accent-soft/10 border border-accent/20 hover:border-accent/40 transition cursor-pointer">
              <div className="flex items-start gap-2">
                <Sparkles size={14} className="text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-100">Incluir análisis con IA en los reportes</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Resumen, destacados y recomendaciones generados automáticamente.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.emailIncludeAIInsights}
                onChange={(e) => set("emailIncludeAIInsights", e.target.checked)}
                className="w-5 h-5 rounded accent-accent flex-shrink-0"
              />
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
            <Button onClick={onSave} loading={saving} size="md">
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>

          <p className="text-[11px] text-gray-600 leading-relaxed">
            Los emails se envían desde nuestro servidor (Resend). Si no llegan, revisá la carpeta
            de spam y agregá el dominio del remitente a contactos.
          </p>
        </>
      )}
    </div>
  )
}

function FrequencyCard({
  icon,
  iconBg,
  title,
  description,
  checked,
  onChange,
  onTest,
  testing,
  disabled,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  onTest: () => void
  testing: boolean
  disabled?: boolean
}) {
  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        checked
          ? "bg-gray-800/60 border-gray-700"
          : "bg-gray-800/30 border-gray-800 hover:bg-gray-800/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${iconBg} border flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-100">{title}</p>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
              className="w-5 h-5 rounded accent-accent flex-shrink-0"
              disabled={disabled}
            />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          {checked && (
            <button
              type="button"
              onClick={onTest}
              disabled={testing || disabled}
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent hover:underline disabled:opacity-50"
            >
              <Send className="w-3 h-3" />
              {testing ? "Enviando..." : "Enviar email de prueba"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
