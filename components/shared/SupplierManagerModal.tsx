"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Plus, Trash2, Edit2, Check, Loader2, Truck } from "lucide-react"
import toast from "react-hot-toast"

interface Supplier {
  id: string
  name: string
  phone: string | null
  email: string | null
  contact: string | null
  active: boolean
}

export function SupplierManagerModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "", email: "", contact: "" })
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", contact: "" })
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/proveedores")
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data.suppliers ?? [])
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
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          contact: form.contact.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Error al crear")
      } else {
        toast.success("Proveedor creado")
        setForm({ name: "", phone: "", email: "", contact: "" })
        await load()
        onChanged?.()
      }
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (s: Supplier) => {
    setEditingId(s.id)
    setEditForm({
      name: s.name,
      phone: s.phone ?? "",
      email: s.email ?? "",
      contact: s.contact ?? "",
    })
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({ name: "", phone: "", email: "", contact: "" })
  }

  const saveEdit = async (id: string) => {
    if (!editForm.name.trim()) return
    setSavingId(id)
    try {
      const res = await fetch(`/api/proveedores/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
          contact: editForm.contact.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Error al actualizar")
      } else {
        toast.success("Proveedor actualizado")
        cancelEdit()
        await load()
        onChanged?.()
      }
    } finally {
      setSavingId(null)
    }
  }

  const remove = async (s: Supplier) => {
    if (!confirm(`¿Eliminar el proveedor "${s.name}"?`)) return
    setDeletingId(s.id)
    try {
      const res = await fetch(`/api/proveedores/${s.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? "Error al eliminar")
      } else {
        toast.success("Proveedor eliminado")
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
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-accent" />
            <h2 className="font-bold text-gray-100">Proveedores</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={create} className="p-5 border-b border-gray-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1.5">
              Nombre *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Distribuidora El Sol"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition"
              maxLength={100}
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1.5">Teléfono</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="11-1234-5678"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="ventas@proveedor.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1.5">Contacto</label>
            <input
              type="text"
              value={form.contact}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              placeholder="Juan Pérez"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={creating || !form.name.trim()}
              className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-accent-foreground font-medium px-5 py-2 rounded-xl flex items-center gap-1.5 transition"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Crear proveedor
            </button>
          </div>
        </form>

        <div className="max-h-[40vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 flex items-center justify-center text-gray-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No hay proveedores todavía. Crea el primero arriba.
            </div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {suppliers.map((s) => (
                <li key={s.id} className="px-5 py-3 hover:bg-gray-800/40 transition">
                  {editingId === s.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Nombre"
                          className="bg-gray-800 border border-accent rounded-lg px-2.5 py-1.5 text-sm text-gray-100 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={editForm.contact}
                          onChange={(e) => setEditForm((f) => ({ ...f, contact: e.target.value }))}
                          placeholder="Contacto"
                          className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-accent"
                        />
                        <input
                          type="text"
                          value={editForm.phone}
                          onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="Teléfono"
                          className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-accent"
                        />
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="Email"
                          className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => saveEdit(s.id)}
                          disabled={savingId === s.id}
                          className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs flex items-center gap-1.5 transition disabled:opacity-60"
                        >
                          {savingId === s.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} />
                          )}
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-100 truncate">{s.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {[s.contact, s.phone, s.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(s)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-accent hover:bg-accent-soft transition"
                          aria-label="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => remove(s)}
                          disabled={deletingId === s.id}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition disabled:opacity-50"
                          aria-label="Eliminar"
                        >
                          {deletingId === s.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </div>
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
