import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formatear moneda Argentina
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(amount)
}

// Formatear número sin moneda
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("es-AR").format(num)
}

// Formatear fecha
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  }).format(d)
}

// Formatear fecha y hora
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

// Calcular porcentaje de ganancia
export function calcProfitPercent(cost: number, sale: number): number {
  if (cost === 0) return 0
  return ((sale - cost) / cost) * 100
}

// Calcular precio de venta desde costo y % ganancia
export function calcSalePrice(cost: number, profitPercent: number): number {
  return cost * (1 + profitPercent / 100)
}

// Redondear a 2 decimales
export function round2(num: number): number {
  return Math.round(num * 100) / 100
}

// Verificar si el stock está bajo
export function isLowStock(stock: number, minStock: number): boolean {
  return stock <= minStock
}

// Colores de stock
export function getStockColor(stock: number, minStock: number, idealStock: number): string {
  if (stock <= 0) return "text-red-600"
  if (stock <= minStock) return "text-orange-500"
  if (stock < idealStock) return "text-yellow-500"
  return "text-green-600"
}

// Nombres de métodos de pago en español
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  DEBIT: "Débito",
  CREDIT: "Crédito",
  TRANSFER: "Transferencia",
  MERCADOPAGO: "Mercado Pago",
  UALA: "Ualá",
  MODO: "MODO",
  NARANJA_X: "Naranja X",
  CUENTA_DNI: "Cuenta DNI",
  LOYALTY_POINTS: "Puntos",
  MIXED: "Mixto",
}

// Íconos de métodos de pago
export const PAYMENT_METHOD_COLORS: Record<string, string> = {
  CASH: "bg-green-500",
  DEBIT: "bg-blue-500",
  CREDIT: "bg-purple-500",
  TRANSFER: "bg-indigo-500",
  MERCADOPAGO: "bg-sky-500",
  UALA: "bg-emerald-500",
  MODO: "bg-orange-500",
  NARANJA_X: "bg-orange-400",
  CUENTA_DNI: "bg-blue-600",
  LOYALTY_POINTS: "bg-yellow-500",
  MIXED: "bg-gray-500",
}
