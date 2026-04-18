"use client"

import { useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { Truck, Plus, Phone, Building2, Edit, Trash2, Search } from "lucide-react"
import toast from "react-hot-toast"
import ProveedorModal from "./ProveedorModal"

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
  initialSuppliers: Supplier[]
}

export default function ProveedoresClient({ initialSuppliers }: Props) {
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase()
    return !q || s.name.toLowerCase().includes(q) || s.cuit?.includes(q) || s.contact?.toLowerCase().includes(q)
  })

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar a "${name}"? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/proveedores/${id}`, { method: "DELETE" })
      if (res.ok) {
        setSuppliers((prev) => prev.filter((s) => s.id !== id))
        toast.success("Proveedor eliminado")
      } else {
        toast.error("No se pudo eliminar el proveedor")
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  const handleSave = (supplier: Supplier) => {
    setSuppliers((prev) => {
      const exists = prev.find((s) => s.id === supplier.id)
      if (exists) return prev.map((s) => (s.id === supplier.id ? supplier : s))
      return [supplier, ...prev]
    })
    setShowModal(false)
    setEditingSupplier(null)
  }

  const totalBalance = suppliers.reduce((s, sup) => s + sup.balance, 0)

  return (
    <div className="p-6 dark:bg-gray-900 dark:text-white min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Proveedores</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{suppliers.length} proveedores activos</p>
        </div>
        <button
          onClick={() => { setEditingSupplier(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-sm font-bold"
        >
          <Plus size={16} />
          Nuevo proveedor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total proveedores</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-white">{suppliers.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Deuda total</p>
          <p className={`text-3xl font-bold ${totalBalance > 0 ? "text-red-600" : "text-green-600"}`}>
            {formatCurrency(Math.abs(totalBalance))}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Con saldo pendiente</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-white">{suppliers.filter((s) => s.balance > 0).length}</p>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="mb-5">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, CUIT o contacto..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 text-left border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Proveedor</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">CUIT</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Teléfono / Contacto</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Productos</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Saldo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400 dark:text-gray-500">
                    <Truck size={48} className="mx-auto mb-3 opacity-40" />
                    <p>{search ? "No se encontraron proveedores" : "No hay proveedores registrados"}</p>
                    {!search && (
                      <button
                        onClick={() => { setEditingSupplier(null); setShowModal(true) }}
                        className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Agregar el primero
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                          <Building2 size={15} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-white text-sm">{supplier.name}</p>
                          {supplier.email && <p className="text-xs text-gray-400 dark:text-gray-500">{supplier.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {supplier.cuit
                        ? <span className="text-sm font-mono text-gray-600 dark:text-gray-300">{supplier.cuit}</span>
                        : <span className="text-gray-300 dark:text-gray-600 text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {supplier.phone && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                            <Phone size={13} className="text-gray-400" />
                            {supplier.phone}
                          </div>
                        )}
                        {supplier.contact && <p className="text-xs text-gray-400 dark:text-gray-500">{supplier.contact}</p>}
                        {!supplier.phone && !supplier.contact && <span className="text-gray-300 dark:text-gray-600 text-sm">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {supplier._count?.products ?? 0} productos
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${supplier.balance > 0 ? "text-red-600" : supplier.balance < 0 ? "text-green-600" : "text-gray-500 dark:text-gray-400"}`}>
                        {supplier.balance !== 0 ? formatCurrency(Math.abs(supplier.balance)) : "—"}
                        {supplier.balance > 0 && <span className="text-xs font-normal ml-1">(a pagar)</span>}
                        {supplier.balance < 0 && <span className="text-xs font-normal ml-1">(a favor)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => { setEditingSupplier(supplier); setShowModal(true) }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier.id, supplier.name)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ProveedorModal
          supplier={editingSupplier}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingSupplier(null) }}
        />
      )}
    </div>
  )
}
