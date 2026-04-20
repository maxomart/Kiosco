import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string, currency = "ARS") {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(num)
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...opts,
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function generatePassword(length = 16): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$"
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("")
}

export const PLAN_LIMITS = {
  FREE: { products: 500, users: 1, reports: false, api: false },
  STARTER: { products: 5000, users: 2, reports: true, api: false },
  PROFESSIONAL: { products: 99999, users: 5, reports: true, api: false },
  BUSINESS: { products: 99999, users: 15, reports: true, api: true },
  ENTERPRISE: { products: 99999, users: 99999, reports: true, api: true },
} as const

export type Plan = keyof typeof PLAN_LIMITS

export const PLAN_PRICES_USD: Record<Plan, number> = {
  FREE: 0,
  STARTER: 25,
  PROFESSIONAL: 60,
  BUSINESS: 150,
  ENTERPRISE: 0, // custom
}

export const PLAN_LABELS: Record<Plan, string> = {
  FREE: "Gratis",
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  BUSINESS: "Business",
  ENTERPRISE: "Enterprise",
}

export const BUSINESS_TYPES = [
  { value: "KIOSCO", label: "Kiosco" },
  { value: "VERDULERIA", label: "Verdulería / Frutería" },
  { value: "MINISUPER", label: "Mini Súper / Almacén" },
  { value: "FARMACIA", label: "Farmacia" },
  { value: "OTRO", label: "Otro" },
]

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Efectivo" },
  { value: "DEBIT", label: "Débito" },
  { value: "CREDIT", label: "Crédito" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "MERCADOPAGO", label: "Mercado Pago" },
  { value: "UALA", label: "Ualá" },
  { value: "MODO", label: "MODO" },
  { value: "NARANJA_X", label: "Naranja X" },
  { value: "CUENTA_DNI", label: "Cuenta DNI" },
  { value: "LOYALTY_POINTS", label: "Puntos" },
  { value: "MIXED", label: "Mixto" },
]
