"use client"

import { useState } from "react"
import { X, Loader2, Receipt, Sparkles } from "lucide-react"
import toast from "react-hot-toast"

interface Category {
  id: string
  name: string
  color?: string | null
}

interface Props {
  categories: Category[]
  onSave: (expense: any) => void
  onClose: () => void
}

export default function GastoModal({ categories, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    description: "",
    amount: "",
    categoryId: "",
    newCategory: "",
    notes: "",
  })
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [useNewCategory, setUseNewCategory] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description.trim()) { toast.error("La descripción es requerida"); return }
    const amount = parseFloat(form.amount.replace(",", "."))
    if (isNaN(amount) || amount <= 0) { toast.error("El monto debe ser mayor a 0"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/gastos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description.trim(),
          amount,
          categoryId: useNewCategory ? null : (form.categoryId || null),
          categoryName: useNewCategory ? form.newCategory.trim() || null : null,
          notes: form.notes.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Error al guardar"); return }

      toast.success("Gasto registrado")
      onSave(data)
    } catch {
      toast.error("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  // IA: sugerir categoría a partir de la descripción
  const suggestCategory = async () => {
    if (!form.description.trim()) {
      toast.error("Escribí primero una descripción")
      return
    }
    setAiLoading(true)
    try {
      const res = await fetch("/api/ia/sugerir-categoria-gasto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          availableCategories: categories.map((c) => c.name),
        }),
      })
      if (res.ok) {
        const { category, isNew } = await res.json()
        if (isNew) {
          setUseNewCategory(true)
          setForm((f) => ({ ...f, newCategory: category }))
          toast.success(`IA sugiere crear categoría "${category}"`, { icon: "✨" })
        } else {
          const match = categories.find((c) => c.name === category)
          if (match) {
            setUseNewCategory(false)
            setForm((f) => ({ ...f, categoryId: match.id }))
            toast.success(`IA sugiere categoría "${category}"`, { icon: "✨" })
          }
        }
      } else {
        toast.error("No se pudo obtener sugerencia de IA")
      }
    } catch {
      toast.error("Error al consultar IA")
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Receipt size={18} className="text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Registrar gasto</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition">
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Factura de luz, carga SUBE, etc."
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white"
            />
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Monto <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
                className="w-full pl-8 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white"
              />
            </div>
          </div>

          {/* Categoría con IA */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</label>
              <button
                type="button"
                onClick={suggestCategory}
                disabled={aiLoading || !form.description.trim()}
                className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 disabled:opacity-40 transition"
                title="Sugerir con IA"
              >
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Sugerir con IA
              </button>
            </div>
            {!useNewCategory ? (
              <div className="flex gap-2">
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setUseNewCategory(true)}
                  className="px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition"
                >
                  + Nueva
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.newCategory}
                  onChange={(e) => setForm({ ...form, newCategory: e.target.value })}
                  placeholder="Nombre de nueva categoría"
                  className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => { setUseNewCategory(false); setForm({ ...form, newCategory: "" }) }}
                  className="px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Observaciones..."
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-semibold text-sm transition"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Registrar gasto
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
