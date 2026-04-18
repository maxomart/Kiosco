"use client"

import { useState, useEffect } from "react"
import { X, Loader2, Truck } from "lucide-react"
import toast from "react-hot-toast"

interface Supplier {
  id: string
  name: string
  cuit?: string | null
  contact?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  balance: number
  _count?: { products: number }
}

interface Props {
  supplier: Supplier | null
  onSave: (supplier: Supplier) => void
  onClose: () => void
}

export default function ProveedorModal({ supplier, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    name: "",
    cuit: "",
    contact: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (supplier) {
      setForm({
        name: supplier.name,
        cuit: supplier.cuit ?? "",
        contact: supplier.contact ?? "",
        phone: supplier.phone ?? "",
        email: supplier.email ?? "",
        address: supplier.address ?? "",
        notes: supplier.notes ?? "",
      })
    }
  }, [supplier])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return }

    setLoading(true)
    try {
      const url = supplier ? `/api/proveedores/${supplier.id}` : "/api/proveedores"
      const method = supplier ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          cuit: form.cuit.trim() || null,
          contact: form.contact.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Error al guardar"); return }

      toast.success(supplier ? "Proveedor actualizado" : "Proveedor creado")
      onSave(data)
    } catch {
      toast.error("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Truck size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">
              {supplier ? "Editar proveedor" : "Nuevo proveedor"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition">
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre / Razón social <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set("name")}
              placeholder="Distribuidora XYZ"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white dark:placeholder-gray-400"
            />
          </div>

          {/* CUIT + Contacto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CUIT</label>
              <input
                type="text"
                value={form.cuit}
                onChange={set("cuit")}
                placeholder="20-12345678-9"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white dark:placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Persona de contacto</label>
              <input
                type="text"
                value={form.contact}
                onChange={set("contact")}
                placeholder="Juan García"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white dark:placeholder-gray-400"
              />
            </div>
          </div>

          {/* Teléfono + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
              <input
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="11 1234-5678"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white dark:placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="ventas@proveedor.com"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white dark:placeholder-gray-400"
              />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección</label>
            <input
              type="text"
              value={form.address}
              onChange={set("address")}
              placeholder="Av. Comercio 456, CABA"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white dark:placeholder-gray-400"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
            <textarea
              value={form.notes}
              onChange={set("notes")}
              placeholder="Días de entrega, condiciones de pago..."
              rows={2}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white dark:placeholder-gray-400 resize-none"
            />
          </div>

          {/* Botones */}
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
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold text-sm transition"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {supplier ? "Guardar cambios" : "Crear proveedor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
