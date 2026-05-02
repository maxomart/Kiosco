"use client"

import { useEffect, useState } from "react"
import { Star, Loader2, Save, Calculator } from "lucide-react"
import toast from "react-hot-toast"
import { formatCurrency } from "@/lib/utils"

interface State {
  loyaltyEnabled: boolean
  loyaltyPointsPerPeso: number
  loyaltyPointValue: number
}

export default function LoyaltyConfigPage() {
  const [data, setData] = useState<State | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/configuracion", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setData({
            loyaltyEnabled: d.loyaltyEnabled ?? false,
            loyaltyPointsPerPeso: d.loyaltyPointsPerPeso ?? 1,
            loyaltyPointValue: d.loyaltyPointValue ?? 1,
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    const r = await fetch("/api/configuracion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loyaltyEnabled: data.loyaltyEnabled,
        loyaltyPointsPerPeso: data.loyaltyPointsPerPeso,
        loyaltyPointValue: data.loyaltyPointValue,
      }),
    })
    setSaving(false)
    if (r.ok) toast.success("Guardado")
    else toast.error("No se pudo guardar")
  }

  if (loading || !data) {
    return <div className="p-6 max-w-3xl mx-auto"><div className="h-32 bg-gray-900 rounded-xl animate-pulse" /></div>
  }

  // Ejemplo: cliente compra $10.000 → suma X puntos → vale Y pesos
  const examplePurchase = 10000
  const examplePoints = Math.floor(examplePurchase * data.loyaltyPointsPerPeso)
  const exampleValue = examplePoints * data.loyaltyPointValue

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-900/40 border border-amber-700/40 flex items-center justify-center">
          <Star className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Programa de fidelidad</h1>
          <p className="text-sm text-gray-400">
            Tus clientes acumulan puntos por cada compra y los canjean como descuento.
          </p>
        </div>
      </div>

      {/* Toggle */}
      <section className="bg-gradient-to-br from-amber-950/30 via-gray-900 to-gray-900 border border-amber-700/30 rounded-xl p-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-white font-semibold">Activar fidelidad</h2>
          <p className="text-xs text-gray-400 mt-1">
            Cada venta a un cliente registrado suma puntos automáticamente.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={data.loyaltyEnabled}
            onChange={(e) => setData({ ...data, loyaltyEnabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className={`w-11 h-6 rounded-full transition-colors ${data.loyaltyEnabled ? "bg-amber-600" : "bg-gray-700"}`}>
            <div className={`w-5 h-5 rounded-full bg-white transition-transform translate-y-0.5 ${data.loyaltyEnabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </div>
        </label>
      </section>

      {/* Tasas */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-white font-semibold">Cuánto vale cada punto</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Puntos por peso gastado" hint="Ej: 0.1 = 1 punto cada $10">
            <input
              type="number" step="0.01" min={0} max={100}
              value={data.loyaltyPointsPerPeso}
              onChange={(e) => setData({ ...data, loyaltyPointsPerPeso: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-amber-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 tabular-nums"
            />
          </Field>
          <Field label="Valor de cada punto en pesos" hint="Ej: 1 = cada punto vale $1 al canjear">
            <input
              type="number" step="0.01" min={0} max={1000}
              value={data.loyaltyPointValue}
              onChange={(e) => setData({ ...data, loyaltyPointValue: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-amber-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 tabular-nums"
            />
          </Field>
        </div>

        <div className="bg-amber-950/30 border border-amber-800/30 rounded-lg p-4 flex gap-3">
          <Calculator size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-100/90 space-y-1">
            <p className="font-semibold">Ejemplo</p>
            <p>
              Si un cliente gasta <strong>{formatCurrency(examplePurchase)}</strong>, suma{" "}
              <strong className="text-amber-300 tabular-nums">{examplePoints} puntos</strong>.
            </p>
            <p>
              Esos puntos valen <strong className="text-amber-300 tabular-nums">{formatCurrency(exampleValue)}</strong> al canjear en una próxima compra.
            </p>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1.5">
        {label} {hint && <span className="text-gray-600 font-normal normal-case">— {hint}</span>}
      </label>
      {children}
    </div>
  )
}
