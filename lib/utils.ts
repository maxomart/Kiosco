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

// Numeric hard limits per plan. Use Number.POSITIVE_INFINITY for "unlimited".
// historyDays = how far back the user can see their own data (sales, reports).
// salesPerMonth = soft cap for the FREE tier so we don't get free-rider abuse.
export const PLAN_LIMITS = {
  FREE: {
    products: 50,
    users: 1,
    clients: 25,
    suppliers: 0,           // 0 = feature locked
    categories: 3,
    salesPerMonth: 200,
    historyDays: 7,
    api: false,
  },
  STARTER: {
    products: 500,
    users: 3,
    clients: Number.POSITIVE_INFINITY,
    suppliers: Number.POSITIVE_INFINITY,
    categories: Number.POSITIVE_INFINITY,
    salesPerMonth: 2000,
    historyDays: 90,
    api: false,
  },
  PROFESSIONAL: {
    products: 5000,
    users: 10,
    clients: Number.POSITIVE_INFINITY,
    suppliers: Number.POSITIVE_INFINITY,
    categories: Number.POSITIVE_INFINITY,
    salesPerMonth: Number.POSITIVE_INFINITY,
    historyDays: 365,
    api: false,
  },
  BUSINESS: {
    products: Number.POSITIVE_INFINITY,
    users: Number.POSITIVE_INFINITY,
    clients: Number.POSITIVE_INFINITY,
    suppliers: Number.POSITIVE_INFINITY,
    categories: Number.POSITIVE_INFINITY,
    salesPerMonth: Number.POSITIVE_INFINITY,
    historyDays: Number.POSITIVE_INFINITY,
    api: true,
  },
  ENTERPRISE: {
    products: Number.POSITIVE_INFINITY,
    users: Number.POSITIVE_INFINITY,
    clients: Number.POSITIVE_INFINITY,
    suppliers: Number.POSITIVE_INFINITY,
    categories: Number.POSITIVE_INFINITY,
    salesPerMonth: Number.POSITIVE_INFINITY,
    historyDays: Number.POSITIVE_INFINITY,
    api: true,
  },
} as const

export type Plan = keyof typeof PLAN_LIMITS

// Native ARS pricing — primary source of truth.
// Update these as inflation moves. Backend MercadoPago Suscripciones uses ARS;
// Stripe legacy paths still consume the USD column (kept for international fallback).
export const PLAN_PRICES_ARS: Record<Plan, number> = {
  FREE: 0,
  STARTER: 9999,        // Básico — anchor at "10 lucas"
  PROFESSIONAL: 24900,  // Pro
  BUSINESS: 59900,      // Negocio
  ENTERPRISE: 0,        // Custom — talk to sales
}

// USD column kept for Stripe + international display ("≈ USD X").
// Recompute periodically: priceARS / blue-chip-rate.
export const PLAN_PRICES_USD: Record<Plan, number> = {
  FREE: 0,
  STARTER: 10,
  PROFESSIONAL: 25,
  BUSINESS: 60,
  ENTERPRISE: 0, // custom
}

// Spanish-natural plan labels for the UI.
export const PLAN_LABELS_AR: Record<Plan, string> = {
  FREE: "Gratis",
  STARTER: "Básico",
  PROFESSIONAL: "Profesional",
  BUSINESS: "Negocio",
  ENTERPRISE: "Empresa",
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
