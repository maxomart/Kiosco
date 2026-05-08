"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { CartItem } from "@/types"

const TAX_RATES: Record<string, number> = {
  ZERO: 0,
  REDUCED: 0.105,
  STANDARD: 0.21,
}

interface POSStore {
  cart: CartItem[]
  discount: number // porcentaje descuento global
  selectedClientId: string | null
  cashSessionId: string | null

  // Actions
  /**
   * Adds a product to the cart. For unit-based products, leave `quantity`
   * undefined (defaults to 1, increments on subsequent calls). For weight
   * products, pass the kg value (e.g. 0.350) — replaces any prior weight
   * for the same product instead of incrementing.
   */
  addToCart: (product: Omit<CartItem, "quantity" | "discount" | "subtotal">, quantity?: number) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateDiscount: (productId: string, discount: number) => void
  setGlobalDiscount: (discount: number) => void
  setClient: (clientId: string | null) => void
  setCashSession: (id: string | null) => void
  clearCart: () => void

  // Computed
  subtotal: () => number
  discountAmount: () => number
  taxAmount: () => number
  total: () => number
}

export const usePOSStore = create<POSStore>()(
  persist(
    (set, get) => ({
      cart: [],
      discount: 0,
      selectedClientId: null,
      cashSessionId: null,

      addToCart: (product, quantity) => {
        const { cart } = get()
        const existing = cart.find((i) => i.productId === product.productId)

        // Weight products always replace the existing line with the new weight
        // (the user just re-weighed the bag). Unit products increment by 1 or
        // by the explicit quantity passed in.
        if (existing) {
          if (product.soldByWeight) {
            const newQty = quantity ?? existing.quantity
            set({
              cart: cart.map((i) =>
                i.productId === product.productId
                  ? {
                      ...i,
                      quantity: newQty,
                      subtotal: Math.round((newQty * i.unitPrice * (1 - i.discount / 100)) * 100) / 100,
                    }
                  : i
              ),
            })
            return
          }
          // Unit product: increment by the requested amount (default 1)
          const inc = quantity ?? 1
          if (existing.quantity + inc > existing.stock) {
            return
          }
          set({
            cart: cart.map((i) =>
              i.productId === product.productId
                ? {
                    ...i,
                    quantity: i.quantity + inc,
                    subtotal: Math.round(((i.quantity + inc) * i.unitPrice * (1 - i.discount / 100)) * 100) / 100,
                  }
                : i
            ),
          })
        } else {
          if (!product.soldByWeight && product.stock <= 0) return
          const initial = quantity ?? 1
          set({
            cart: [
              ...cart,
              {
                ...product,
                quantity: initial,
                discount: 0,
                subtotal: Math.round(initial * product.unitPrice * 100) / 100,
              },
            ],
          })
        }
      },

      removeFromCart: (productId) => {
        set({ cart: get().cart.filter((i) => i.productId !== productId) })
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(productId)
          return
        }
        set({
          cart: get().cart.map((i) => {
            if (i.productId !== productId) return i
            // Same stock guard for the +/- buttons in CartPanel.
            const capped = !i.soldByWeight ? Math.min(quantity, i.stock) : quantity
            return {
              ...i,
              quantity: capped,
              subtotal: Math.round((capped * i.unitPrice * (1 - i.discount / 100)) * 100) / 100,
            }
          }),
        })
      },

      updateDiscount: (productId, discount) => {
        set({
          cart: get().cart.map((i) =>
            i.productId === productId
              ? {
                  ...i,
                  discount,
                  subtotal: Math.round((i.quantity * i.unitPrice * (1 - discount / 100)) * 100) / 100,
                }
              : i
          ),
        })
      },

      setGlobalDiscount: (discount) => set({ discount }),
      setClient: (clientId) => set({ selectedClientId: clientId }),
      setCashSession: (id) => set({ cashSessionId: id }),

      clearCart: () =>
        set({ cart: [], discount: 0, selectedClientId: null }),

      subtotal: () => {
        return get().cart.reduce((acc, i) => acc + i.subtotal, 0)
      },

      discountAmount: () => {
        const { subtotal, discount } = get()
        return Math.round(subtotal() * (discount / 100) * 100) / 100
      },

      taxAmount: () => {
        const { discountAmount, discount } = get()
        const globalMultiplier = 1 - discount / 100
        return get().cart.reduce((acc, i) => {
          const afterDiscount = i.subtotal * globalMultiplier
          const rate = TAX_RATES[i.taxRate] ?? 0
          return acc + afterDiscount * (rate / (1 + rate))
        }, 0)
      },

      total: () => {
        const { subtotal, discountAmount } = get()
        return Math.round((subtotal() - discountAmount()) * 100) / 100
      },
    }),
    {
      name: "orvex-pos-cart",
      storage: createJSONStorage(() => sessionStorage), // sessionStorage: se limpia al cerrar tab
      partialize: (state) => ({
        cart: state.cart,
        discount: state.discount,
        selectedClientId: state.selectedClientId,
        cashSessionId: state.cashSessionId,
      }),
    }
  )
)
