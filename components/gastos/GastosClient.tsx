"use client"

import { useState, useMemo } from "react"
import { formatCurrency } from "@/lib/utils"
import { Receipt, Plus, Tag, Trash2 } from "lucide-react"
import toast from "react-hot-toast"
import { startOfMonth, endOfMonth } from "date-fns"
import GastoModal from "./GastoModal"

interface Expense {
  id: string
  description: string
  amount: number
  categoryId?: string | null
  notes?: string | null
  createdAt: string | Date
  category?: { id: string; name: string; color?: string | null } | null
}

interface Category {
  id: string
  name: string
  color?: string | null
}

interface Props {
  initialExpenses: Expense[]
  categories: Category[]
}

export default function GastosClient({ initialExpenses, categories }: Props) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [showModal, setShowModal] = useState(false)

  const { monthTotal, monthCount, grouped, uncategorized, uncategorizedTotal } = useMemo(() => {
    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)

    const monthExpenses = expenses.filter((e) => {
      const d = new Date(e.createdAt)
      return d >= monthStart && d <= monthEnd
    })

    const grouped = categories.map((cat) => ({
      ...cat,
      expenses: expenses.filter((e) => e.categoryId === cat.id),
      total: expenses.filter((e) => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0),
    }))

    const uncategorized = expenses.filter((e) => !e.categoryId)
    const uncategorizedTotal = uncategorized.reduce((s, e) => s + e.amount, 0)

    return {
      monthTotal: monthExpenses.reduce((s, e) => s + e.amount, 0),
      monthCount: monthExpenses.length,
      grouped,
      uncategorized,
      uncategorizedTotal,
    }
  }, [expenses, categories])

  const handleSave = (expense: Expense) => {
    setExpenses((prev) => [expense, ...prev])
    setShowModal(false)
  }

  const handleDelete = async (id: string, description: string) => {
    if (!confirm(`¿Eliminar el gasto "${description}"?`)) return
    try {
      const res = await fetch(`/api/gastos/${id}`, { method: "DELETE" })
      if (res.ok) {
        setExpenses((prev) => prev.filter((e) => e.id !== id))
        toast.success("Gasto eliminado")
      } else {
        toast.error("No se pudo eliminar")
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  return (
    <div className="p-6 dark:bg-gray-900 dark:text-white min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Gastos</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{expenses.length} registros</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-sm font-bold"
        >
          <Plus size={16} />
          Registrar gasto
        </button>
      </div>

      {/* Month total */}
      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 mb-6 text-white shadow-lg">
        <p className="text-red-100 text-sm font-semibold uppercase tracking-wide mb-1">Gastos este mes</p>
        <p className="text-4xl font-bold">{formatCurrency(monthTotal)}</p>
        <p className="text-red-100 text-sm mt-1">{monthCount} registros en el mes</p>
      </div>

      {/* Category sections */}
      <div className="space-y-4">
        {grouped.filter((g) => g.expenses.length > 0).map((group) => (
          <div
            key={group.id}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color || "#6b7280" }} />
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-gray-400 dark:text-gray-500" />
                  <h3 className="font-bold text-gray-800 dark:text-white text-sm">{group.name}</h3>
                </div>
              </div>
              <span className="text-sm font-bold text-red-600">{formatCurrency(group.total)}</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {group.expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between px-5 py-3 group">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{expense.description}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(expense.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {formatCurrency(expense.amount)}
                    </span>
                    <button
                      onClick={() => handleDelete(expense.id, expense.description)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {uncategorized.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <h3 className="font-bold text-gray-800 dark:text-white text-sm">Sin categoría</h3>
              </div>
              <span className="text-sm font-bold text-red-600">{formatCurrency(uncategorizedTotal)}</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {uncategorized.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between px-5 py-3 group">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{expense.description}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(expense.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {formatCurrency(expense.amount)}
                    </span>
                    <button
                      onClick={() => handleDelete(expense.id, expense.description)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {expenses.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-16 text-center shadow-sm">
            <Receipt size={48} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">No hay gastos registrados</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Registrar el primer gasto
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <GastoModal
          categories={categories}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
