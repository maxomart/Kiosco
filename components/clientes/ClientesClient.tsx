"use client"

import { useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { Users, Plus, Phone, Mail, Star, Wallet, Edit, Trash2, Search, Info } from "lucide-react"
import toast from "react-hot-toast"
import ClientModal from "./ClientModal"

interface Client {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  dni?: string | null
  address?: string | null
  notes?: string | null
  loyaltyPoints: number
  balance: number
}

interface Props {
  initialClients: Client[]
}

export default function ClientesClient({ initialClients }: Props) {
  const [clients, setClients] = useState(initialClients)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.dni?.includes(q)
  })

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar a "${name}"? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" })
      if (res.ok) {
        setClients((prev) => prev.filter((c) => c.id !== id))
        toast.success("Cliente eliminado")
      } else {
        toast.error("No se pudo eliminar el cliente")
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  const handleSave = (client: Client) => {
    setClients((prev) => {
      const exists = prev.find((c) => c.id === client.id)
      if (exists) return prev.map((c) => (c.id === client.id ? client : c))
      return [client, ...prev]
    })
    setShowModal(false)
    setEditingClient(null)
  }

  const totalPoints = clients.reduce((s, c) => s + c.loyaltyPoints, 0)
  const totalBalance = clients.reduce((s, c) => s + c.balance, 0)

  return (
    <div className="p-6 dark:bg-gray-900 dark:text-white min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Clientes</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{clients.length} clientes registrados</p>
        </div>
        <button
          onClick={() => { setEditingClient(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-sm font-bold"
        >
          <Plus size={16} />
          Nuevo cliente
        </button>
      </div>

      {/* Card informativa */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl mb-6">
        <Info size={18} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Registrá clientes frecuentes para hacer seguimiento de sus compras, ofrecer crédito y ver su historial. También podés usarlos para ventas en cuenta corriente.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total clientes</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-white">{clients.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Puntos totales</p>
          <p className="text-3xl font-bold text-blue-600">{totalPoints.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Saldo total</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-white">{formatCurrency(totalBalance)}</p>
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
            placeholder="Buscar por nombre, teléfono o DNI..."
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
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nombre</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Teléfono</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Saldo</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Puntos</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400 dark:text-gray-500">
                    <Users size={48} className="mx-auto mb-3 opacity-40" />
                    <p>{search ? "No se encontraron clientes" : "No hay clientes registrados"}</p>
                    {!search && (
                      <button
                        onClick={() => { setEditingClient(null); setShowModal(true) }}
                        className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Agregar el primero
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                            {client.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-white text-sm">{client.name}</p>
                          {client.dni && <p className="text-xs text-gray-400 dark:text-gray-500">DNI: {client.dni}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {client.phone ? (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                          <Phone size={13} className="text-gray-400" />
                          {client.phone}
                        </div>
                      ) : <span className="text-gray-300 dark:text-gray-600 text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {client.email ? (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                          <Mail size={13} className="text-gray-400" />
                          {client.email}
                        </div>
                      ) : <span className="text-gray-300 dark:text-gray-600 text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Wallet size={13} className="text-gray-400" />
                        <span className={`text-sm font-semibold ${client.balance < 0 ? "text-red-600" : "text-gray-800 dark:text-white"}`}>
                          {formatCurrency(client.balance)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Star size={13} className="text-yellow-500" />
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {client.loyaltyPoints.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => { setEditingClient(client); setShowModal(true) }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(client.id, client.name)}
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
        <ClientModal
          client={editingClient}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingClient(null) }}
        />
      )}
    </div>
  )
}
