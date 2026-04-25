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
  addToCart: (product: Omit<CartItem, "quantity" | "discount" | "subtotal">) => void
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

      addToCart: (product) => {
        const { cart } = get()
        const existing = cart.find((i) => i.productId === product.productId)
        if (existing) {
          set({
            cart: cart.map((i) =>
              i.productId === product.productId
                ? {
                    ...i,
                    quantity: i.quantity + 1,
                    subtotal: Math.round(((i.quantity + 1) * i.unitPrice * (1 - i.discount / 100)) * 100) / 100,
                  }
                : i
            ),
          })
        } else {
          set({
            cart: [
              ...cart,
              {
                ...product,
                quantity: 1,
                discount: 0,
                subtotal: Math.round(product.unitPrice * 100) / 100,
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
          cart: get().cart.map((i) =>
            i.productId === productId
              ? {
                  ...i,
                  quantity,
                  subtotal: Math.round((quantity * i.unitPrice * (1 - i.discount / 100)) * 100) / 100,
                }
              : i
          ),
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
