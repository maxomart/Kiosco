"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Plus, Trash2, Truck, Users, Info, Package, Search, X, ChevronDown, ChevronUp } from "lucide-react"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { SupplierManagerModal } from "@/components/shared/SupplierManagerModal"
import { useConfirm } from "@/components/shared/ConfirmDialog"

interface RechargeItem {
  id: string
  productName: string
  quantity: number
  unitCost: number
  totalCost: number
  productId: string | null
}

interface Recharge {
  id: string
  number: number
  cost: number
  amount: number
  profit: number
  notes: string | null
  createdAt: string
  supplier: { id: string; name: string } | null
  items: RechargeItem[]
}

interface Supplier { id: string; name: string }

interface Product {
  id: string
  name: string
  stock: number
  costPrice: number
  barcode: string | null
}

interface CartItem {
  productId: string
  productName: string
  quantity: number
  unitCost: number
  currentStock: number
}

export default function CargasPage() {
  const [recharges, setRecharges] = useState<Recharge[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [supplierId, setSupplierId] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState("")
  const [notes, setNotes] = useState("")
  const [updateCostPrice, setUpdateCostPrice] = useState(true)
  const [productSearch, setProductSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [showSuppliers, setShowSuppliers] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0] })
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0])
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ from: `${from}T00:00:00`, to: `${to}T23:59:59` })
    const [rRes, sRes, pRes] = await Promise.all([
      fetch(`/api/cargas?${params}`),
      fetch("/api/proveedores"),
      fetch("/api/v1/products?limit=500"),
    ])
    if (rRes.ok) { const d = await rRes.json(); setRecharges(d.recharges || []) }
    if (sRes.ok) { const d = await sRes.json(); setSuppliers(d.suppliers || []) }
    if (pRes.ok) { const d = await pRes.json(); setProducts(d.products || d.data || []) }
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products.slice(0, 12)
    return products
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q))
      )
      .slice(0, 12)
  }, [products, productSearch])

  const subtotal = cart.reduce((sum, i) => sum + i.unitCost * i.quantity, 0)
  const discountNum = parseFloat(discount) || 0
  const total = Math.max(0, subtotal - discountNum)

  const addProduct = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) {
        return prev.map(i =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitCost: Number(product.costPrice) || 0,
        currentStock: product.stock,
      }]
    })
    setProductSearch("")
  }

  const updateCartItem = (productId: string, patch: Partial<CartItem>) => {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, ...patch } : i))
  }

  const removeCartItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId))
  }

  const resetForm = () => {
    setCart([])
    setSupplierId("")
    setDiscount("")
    setNotes("")
    setUpdateCostPrice(true)
    setProductSearch("")
    setError(null)
  }

  const handleSave = async () => {
    setError(null)
    if (!supplierId) return setError("Seleccioná un proveedor")
    if (cart.length === 0) return setError("Agregá al menos un producto")
    if (cart.some(i => i.unitCost < 0)) return setError("Los precios no pueden ser negativos")
    if (cart.some(i => i.quantity < 1)) return setError("La cantidad debe ser 1 o más")

    setSaving(true)
    const res = await fetch("/api/cargas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        items: cart.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
        discount: discountNum,
        notes: notes || null,
        updateCostPrice,
      }),
    })
    if (res.ok) {
      resetForm()
      setShowForm(false)
      await load()
    } else {
      const d = await res.json()
      setError(d.error || "Error al registrar la carga")
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "¿Eliminar esta carga?",
      description: "El stock que se agregó no se revierte automáticamente. Ajustalo manualmente si corresponde.",
      confirmText: "Eliminar",
      tone: "danger",
    })
    if (!ok) return
    setDeleting(id)
    await fetch(`/api/cargas/${id}`, { method: "DELETE" })
    await load()
    setDeleting(null)
  }

  const totalPaid = recharges.reduce((acc, r) => acc + Number(r.cost), 0)
  const totalFactured = recharges.reduce((acc, r) => acc + Number(r.amount), 0)
  const totalDiscount = recharges.reduce((acc, r) => acc + Number(r.profit), 0)
  const totalItems = recharges.reduce((acc, r) => acc + (r.items?.reduce((s, i) => s + i.quantity, 0) || 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Compras a Proveedor</h1>
          <p className="text-gray-400 text-sm mt-1">Cada carga suma automáticamente al stock de tus productos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSuppliers(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">
            <Users size={16} /> Proveedores
          </button>
          <button onClick={() => { setShowForm(!showForm); if (showForm) resetForm() }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-medium transition-colors">
            <Plus size={16} /> Nueva carga
          </button>
        </div>
      </div>

      {/* Explicación contextual */}
      {recharges.length === 0 && !showForm && !loading && (
        <div className="bg-gradient-to-br from-accent-soft/50 to-accent-soft/10 border border-accent/30 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold mb-1">¿Cómo funciona?</h3>
              <p className="text-sm text-gray-300 mb-2">
                Cada vez que te trae mercadería un proveedor, registrás una carga con los productos y las cantidades.
                El sistema <strong>suma al stock automáticamente</strong> y actualiza el costo de cada producto.
              </p>
              <p className="text-xs text-gray-500">
                💡 Seleccionás el proveedor → agregás los productos → cantidad + precio unitario → listo. Se aplica en una transacción.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-5">
          <div>
            <h3 className="text-white font-semibold text-base">Registrar nueva carga</h3>
            <p className="text-xs text-gray-500 mt-1">
              El stock se actualizará al guardar
            </p>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Supplier */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Proveedor *</label>
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500">
              <option value="">Seleccionar...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {suppliers.length === 0 && (
              <p className="text-xs text-yellow-500 mt-1">
                Necesitás dar de alta un proveedor antes.{" "}
                <button type="button" onClick={() => setShowSuppliers(true)} className="text-accent underline hover:text-accent-hover">
                  Crear ahora
                </button>
              </p>
            )}
          </div>

          {/* Product Search */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Agregar productos *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Buscar por nombre o código de barras..."
                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>

            {productSearch && filteredProducts.length > 0 && (
              <div className="mt-2 border border-gray-800 rounded-lg overflow-hidden bg-gray-950 max-h-60 overflow-y-auto">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-800 border-b border-gray-800 last:border-0 transition-colors flex justify-between items-center gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-500">
                        Stock actual: {p.stock} · Costo: {formatCurrency(Number(p.costPrice))}
                      </p>
                    </div>
                    <Plus className="w-4 h-4 text-accent flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {productSearch && filteredProducts.length === 0 && (
              <p className="text-xs text-gray-500 mt-2">Ningún producto coincide con "{productSearch}"</p>
            )}
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <div className="border border-gray-800 rounded-lg overflow-hidden">
              <div className="bg-gray-800/50 px-3 py-2 text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                Productos en esta carga ({cart.length})
              </div>
              <div className="divide-y divide-gray-800">
                {cart.map(item => (
                  <div key={item.productId} className="p-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-sm text-white">{item.productName}</p>
                      <p className="text-[10px] text-gray-500">
                        Stock: {item.currentStock} → {item.currentStock + item.quantity}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateCartItem(item.productId, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Costo unit.</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitCost}
                          onChange={e => updateCartItem(item.productId, { unitCost: parseFloat(e.target.value) || 0 })}
                          className="w-24 pl-5 pr-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm text-right"
                        />
                      </div>
                    </div>
                    <div className="text-right min-w-[90px]">
                      <p className="text-[10px] text-gray-500">Subtotal</p>
                      <p className="text-sm text-white font-medium">{formatCurrency(item.unitCost * item.quantity)}</p>
                    </div>
                    <button onClick={() => removeCartItem(item.productId)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400">
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          {cart.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Descuento (opcional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={discount} onChange={e => setDiscount(e.target.value)}
                    min="0" step="0.01" placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Notas</label>
                <input value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="N° de remito, observaciones..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>

              <div className="md:col-span-2 bg-gray-800/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white">{formatCurrency(subtotal)}</span>
                </div>
                {discountNum > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Descuento</span>
                    <span className="text-emerald-400">-{formatCurrency(discountNum)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-700">
                  <span className="text-white">Total a pagar</span>
                  <span className="text-accent">{formatCurrency(total)}</span>
                </div>
              </div>

              <label className="md:col-span-2 flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={updateCostPrice}
                  onChange={e => setUpdateCostPrice(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-700 bg-gray-800" />
                Actualizar el costo de los productos con este precio
                <span className="text-xs text-gray-500">(útil si cambió el precio del proveedor)</span>
              </label>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); resetForm() }}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !supplierId || cart.length === 0}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-foreground text-sm font-medium">
              {saving ? "Guardando..." : `Registrar carga (${cart.length} ${cart.length === 1 ? "producto" : "productos"})`}
            </button>
          </div>
        </div>
      )}

      {/* Stats + filter */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
          <p className="text-xs text-gray-500">Total pagado</p>
          <p className="text-white font-semibold">{formatCurrency(totalPaid)}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">Facturado: {formatCurrency(totalFactured)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
          <p className="text-xs text-gray-500">Unidades ingresadas</p>
          <p className="text-white font-semibold">{totalItems}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">Sumaron al stock</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-950/30 border border-emerald-800/40 rounded-xl px-4 py-3">
          <p className="text-xs text-emerald-400 font-medium">Descuentos</p>
          <p className={`font-bold text-lg ${totalDiscount >= 0 ? "text-emerald-300" : "text-red-400"}`}>
            {formatCurrency(totalDiscount)}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {totalFactured > 0 ? `${((totalDiscount / totalFactured) * 100).toFixed(1)}% ahorro` : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap md:justify-end">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500" />
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="p-4 text-left text-gray-400 font-medium">N°</th>
              <th className="p-4 text-left text-gray-400 font-medium">Proveedor</th>
              <th className="p-4 text-right text-gray-400 font-medium">Items</th>
              <th className="p-4 text-right text-gray-400 font-medium">Unid.</th>
              <th className="p-4 text-right text-gray-400 font-medium">Total pagado</th>
              <th className="p-4 text-left text-gray-400 font-medium">Fecha</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td></tr>
              ))
            ) : recharges.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-gray-500">
                  <Truck size={36} className="mx-auto mb-2 opacity-30" />
                  No hay cargas en este período
                </td>
              </tr>
            ) : recharges.map(r => {
              const itemCount = r.items?.length || 0
              const unitCount = r.items?.reduce((s, i) => s + i.quantity, 0) || 0
              const isExpanded = expandedId === r.id
              return (
                <>
                  <tr key={r.id} className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                    <td className="p-4 font-mono text-purple-400">#{r.number}</td>
                    <td className="p-4">
                      <p className="text-white">{r.supplier?.name ?? "—"}</p>
                      {r.notes && <p className="text-gray-500 text-xs mt-0.5">{r.notes}</p>}
                    </td>
                    <td className="p-4 text-right text-gray-300">{itemCount}</td>
                    <td className="p-4 text-right text-gray-300">{unitCount}</td>
                    <td className="p-4 text-right text-white font-medium">{formatCurrency(r.cost)}</td>
                    <td className="p-4 text-gray-400">{formatDateTime(r.createdAt)}</td>
                    <td className="p-4 flex items-center gap-1 justify-end">
                      {isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id) }} disabled={deleting === r.id}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                  {isExpanded && r.items && r.items.length > 0 && (
                    <tr key={`${r.id}-detail`} className="bg-gray-950/50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="space-y-1.5">
                          {r.items.map(item => (
                            <div key={item.id} className="flex items-center justify-between text-xs gap-3">
                              <span className="text-gray-300 flex-1 truncate">{item.productName}</span>
                              <span className="text-gray-500">{item.quantity} × {formatCurrency(Number(item.unitCost))}</span>
                              <span className="text-white font-medium min-w-[80px] text-right">{formatCurrency(Number(item.totalCost))}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      <SupplierManagerModal
        open={showSuppliers}
        onClose={() => setShowSuppliers(false)}
        onChanged={() => load()}
      />
    </div>
  )
}
