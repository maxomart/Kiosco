// ============================================================
// Base de datos offline con Dexie (IndexedDB)
// Permite seguir vendiendo sin internet
// ============================================================

import Dexie, { type EntityTable } from "dexie"

interface OfflineProduct {
  id: string
  name: string
  barcode?: string
  sku?: string
  salePrice: number
  costPrice: number
  stock: number
  minStock: number
  unit: string
  soldByWeight: boolean
  taxRate: string
  categoryId?: string
  categoryName?: string
  imageUrl?: string
  active: boolean
}

interface OfflineSale {
  id: string
  items: Array<{
    productId: string
    productName: string
    quantity: number
    unitPrice: number
    costPrice: number
    discount: number
    subtotal: number
  }>
  subtotal: number
  discountAmount: number
  total: number
  paymentMethod: string
  cashReceived?: number
  change?: number
  clientId?: string
  note?: string
  userId: string
  createdAt: string
  synced: boolean // false = pendiente de sincronizar
}

interface SyncLog {
  id?: number
  type: string
  payload: object
  createdAt: string
  synced: boolean
  error?: string
}

class KioscoDB extends Dexie {
  products!: EntityTable<OfflineProduct, "id">
  offlineSales!: EntityTable<OfflineSale, "id">
  syncLog!: EntityTable<SyncLog, "id">

  constructor() {
    super("kiosco-offline-db")

    this.version(1).stores({
      products: "id, barcode, sku, name, categoryId, active",
      offlineSales: "id, synced, createdAt",
      syncLog: "++id, type, synced, createdAt",
    })
  }
}

export const offlineDb = new KioscoDB()

// ============================================================
// HELPERS
// ============================================================

// Sincronizar productos desde el servidor al almacenamiento local
export async function syncProductsToOffline(products: OfflineProduct[]) {
  await offlineDb.products.bulkPut(products)
}

// Buscar productos offline
export async function searchProductsOffline(query: string): Promise<OfflineProduct[]> {
  const q = query.toLowerCase()
  const all = await offlineDb.products.where("active").equals(1 as any).toArray()
  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.barcode?.includes(q) ||
      p.sku?.toLowerCase().includes(q)
  )
}

// Buscar por código de barras offline
export async function findByBarcodeOffline(barcode: string): Promise<OfflineProduct | undefined> {
  return offlineDb.products.where("barcode").equals(barcode).first()
}

// Guardar venta offline (cuando no hay internet)
export async function saveOfflineSale(sale: OfflineSale) {
  await offlineDb.offlineSales.add(sale)
  // Actualizar stock localmente
  for (const item of sale.items) {
    const product = await offlineDb.products.get(item.productId)
    if (product) {
      await offlineDb.products.update(item.productId, {
        stock: Math.max(0, product.stock - item.quantity),
      })
    }
  }
}

// Obtener ventas pendientes de sincronizar
export async function getPendingSales(): Promise<OfflineSale[]> {
  return offlineDb.offlineSales.where("synced").equals(0).toArray()
}

// Marcar venta como sincronizada
export async function markSaleSynced(id: string) {
  await offlineDb.offlineSales.update(id, { synced: true })
}
