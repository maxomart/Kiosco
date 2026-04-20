"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Plus, Trash2, Edit2, Check, Loader2, Tag } from "lucide-react"
import toast from "react-hot-toast"

interface Category {
  id: string
  name: string
  active: boolean
}

export function CategoryManagerModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/categorias")
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Error al crear")
      } else {
        toast.success("Categoría creada")
        setNewName("")
        await load()
        onChanged?.()
      }
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (c: Category) => {
    setEditingId(c.id)
    setEditName(c.name)
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditName("")
  }

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return
    setSavingId(id)
    try {
      const res = await fetch(`/api/categorias/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Error al actualizar")
      } else {
        toast.success("Categoría actualizada")
        cancelEdit()
        await load()
        onChanged?.()
      }
    } finally {
      setSavingId(null)
    }
  }

  const remove = async (c: Category) => {
    if (!confirm(`¿Eliminar la categoría "${c.name}"?`)) return
    setDeletingId(c.id)
    try {
      const res = await fetch(`/api/categorias/${c.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Error al eliminar")
      } else if (data.softDeleted) {
        toast.success(`Categoría desactivada (${data.productsAffected} producto(s) la usaban)`)
        await load()
        onChanged?.()
      } else {
        toast.success("Categoría eliminada")
        await load()
        onChanged?.()
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-purple-400" />
            <h2 className="font-bold text-gray-100">Categorías</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={create} className="p-5 border-b border-gray-800">
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">
            Nueva categoría
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej: Bebidas, Limpieza, Lácteos…"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
              maxLength={60}
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              <span className="hidden sm:inline">Crear</span>
            </button>
          </div>
        </form>

        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 flex items-center justify-center text-gray-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : categories.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No hay categorías todavía. Crea la primera arriba.
            </div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 px-5 py-3 hover:bg-gray-800/40 transition"
                >
                  {editingId === c.id ? (
                    <>
                      <input
                        autoFocus
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(c.id)
                          if (e.key === "Escape") cancelEdit()
                        }}
                        className="flex-1 bg-gray-800 border border-purple-500 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none"
                      />
                      <button
                        onClick={() => saveEdit(c.id)}
                        disabled={savingId === c.id}
                        className="p-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition"
                        aria-label="Guardar"
                      >
                        {savingId === c.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Check size={14} />
                        )}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition"
                        aria-label="Cancelar"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-100 truncate">{c.name}</span>
                      <button
                        onClick={() => startEdit(c)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-purple-300 hover:bg-purple-900/30 transition"
                        aria-label="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => remove(c)}
                        disabled={deletingId === c.id}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition disabled:opacity-50"
                        aria-label="Eliminar"
                      >
                        {deletingId === c.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-5 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-5 py-2 rounded-xl transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
