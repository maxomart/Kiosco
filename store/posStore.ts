import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface CartItem {
  productId: string
  name: string
  barcode?: string
  price: number
  costPrice: number
  quantity: number
  discount: number // Descuento en % por ítem
  subtotal: number
  taxRate: "ZERO" | "REDUCED" | "STANDARD"
  unit: string
  soldByWeight: boolean
}

export type PaymentMethod =
  | "CASH"
  | "DEBIT"
  | "CREDIT"
  | "TRANSFER"
  | "MERCADOPAGO"
  | "UALA"
  | "MODO"
  | "NARANJA_X"
  | "CUENTA_DNI"
  | "MIXED"

interface POSState {
  // Carrito
  items: CartItem[]
  clientId: string | null
  clientName: string | null
  discount: number // Descuento global en %
  note: string

  // Totales calculados
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number

  // Acciones del carrito
  addItem: (product: Omit<CartItem, "quantity" | "discount" | "subtotal">) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateItemDiscount: (productId: string, discount: number) => void
  setDiscount: (discount: number) => void
  setClient: (id: string | null, name: string | null) => void
  setNote: (note: string) => void
  clearCart: () => void

  // Recalcular totales
  recalculate: () => void
}

const TAX_RATES = {
  ZERO: 0,
  REDUCED: 0.105,
  STANDARD: 0.21,
}

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      items: [],
      clientId: null,
      clientName: null,
      discount: 0,
      note: "",
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      total: 0,

      addItem: (product) => {
        const state = get()
        const existingIndex = state.items.findIndex((i) => i.productId === product.productId)

        let newItems: CartItem[]

        if (existingIndex >= 0) {
          // Si ya existe, incrementar cantidad
          newItems = state.items.map((item, idx) => {
            if (idx === existingIndex) {
              const qty = item.quantity + 1
              const subtotal = item.price * qty * (1 - item.discount / 100)
              return { ...item, quantity: qty, subtotal }
            }
            return item
          })
        } else {
          // Agregar nuevo ítem
          const newItem: CartItem = {
            ...product,
            quantity: 1,
            discount: 0,
            subtotal: product.price,
          }
          newItems = [...state.items, newItem]
        }

        set({ items: newItems })
        get().recalculate()
      },

      removeItem: (productId) => {
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) }))
        get().recalculate()
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        set((state) => ({
          items: state.items.map((item) => {
            if (item.productId === productId) {
              const subtotal = item.price * quantity * (1 - item.discount / 100)
              return { ...item, quantity, subtotal }
            }
            return item
          }),
        }))
        get().recalculate()
      },

      updateItemDiscount: (productId, discount) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.productId === productId) {
              const subtotal = item.price * item.quantity * (1 - discount / 100)
              return { ...item, discount, subtotal }
            }
            return item
          }),
        }))
        get().recalculate()
      },

      setDiscount: (discount) => {
        set({ discount })
        get().recalculate()
      },

      setClient: (id, name) => set({ clientId: id, clientName: name }),
      setNote: (note) => set({ note }),

      clearCart: () =>
        set({
          items: [],
          clientId: null,
          clientName: null,
          discount: 0,
          note: "",
          subtotal: 0,
          discountAmount: 0,
          taxAmount: 0,
          total: 0,
        }),

      recalculate: () => {
        const { items, discount } = get()

        const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0)
        const discountAmount = subtotal * (discount / 100)
        const afterDiscount = subtotal - discountAmount

        // Calcular IVA (el precio ya incluye IVA en Argentina para consumidor final)
        const taxAmount = items.reduce((acc, item) => {
          const taxRate = TAX_RATES[item.taxRate]
          const itemAfterDiscount = item.subtotal * (1 - discount / 100)
          return acc + itemAfterDiscount * (taxRate / (1 + taxRate))
        }, 0)

        set({
          subtotal,
          discountAmount,
          taxAmount,
          total: Math.round(afterDiscount * 100) / 100,
        })
      },
    }),
    {
      name: "kiosco-pos-cart",
      // Solo persistir el carrito para no perder ventas si se recarga
      partialize: (state) => ({
        items: state.items,
        clientId: state.clientId,
        clientName: state.clientName,
        discount: state.discount,
        note: state.note,
      }),
    }
  )
)
