import type { Plan } from "@/lib/utils"

export type UserRole = "SUPER_ADMIN" | "OWNER" | "ADMIN" | "CASHIER"

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  tenantId: string | null
  image?: string | null
}

export interface TenantWithStats {
  id: string
  name: string
  slug: string
  active: boolean
  createdAt: string
  subscription?: { plan: Plan; status: string }
  _count: {
    users: number
    products: number
    sales: number
    clients: number
  }
}

export interface ProductFull {
  id: string
  name: string
  description: string | null
  sku: string | null
  barcode: string | null
  costPrice: number
  salePrice: number
  stock: number
  minStock: number
  active: boolean
  image: string | null
  soldByWeight: boolean
  tenantId: string
  categoryId: string | null
  supplierId: string | null
  category?: { id: string; name: string } | null
  supplier?: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface SaleFull {
  id: string
  number: number
  subtotal: number
  discountAmount: number
  discountPercent: number
  taxAmount: number
  total: number
  paymentMethod: string
  cashReceived: number | null
  change: number | null
  status: string
  cancelReason: string | null
  notes: string | null
  createdAt: string
  tenantId: string
  user: { name: string }
  client: { name: string } | null
  items: SaleItemFull[]
}

export interface SaleItemFull {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  costPrice: number
  discount: number
  subtotal: number
  taxRate: string
  taxAmount: number
}

export interface CartItem {
  productId: string
  productName: string
  barcode: string | null
  quantity: number
  unitPrice: number
  costPrice: number
  stock: number
  discount: number
  subtotal: number
  taxRate: "ZERO" | "REDUCED" | "STANDARD"
  soldByWeight: boolean
}

export interface ClientFull {
  id: string
  name: string
  phone: string | null
  email: string | null
  dni: string | null
  address: string | null
  notes: string | null
  active: boolean
  loyaltyPoints: number
  tenantId: string
  createdAt: string
}

export interface ReportData {
  totalSales: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
  profitMargin: number
  avgTicket: number
  topProducts: { productName: string; quantity: number; revenue: number }[]
  salesByMethod: { method: string; count: number; total: number }[]
  salesByHour: { hour: number; count: number; total: number }[]
  dailySales: { date: string; total: number; count: number }[]
}

// ============= ANALYTICS TYPES =============
export interface ProductMarginAnalysis {
  productId: string
  productName: string
  currentMarginPct: number
  potentialMarginPct: number
  salesQuantity30d: number
  daysToStockout: number
  rotationRate: number
  healthStatus: "HIGH" | "MEDIUM" | "LOW" | "DEAD"
  currentStock: number
  avgDailySales: number
}

export interface StockPrediction {
  productId: string
  productName: string
  currentStock: number
  avgDailySales: number
  daysUntilStockout: number
  recommendedQuantity: number
  estimatedCost: number
  urgency: "CRITICAL" | "HIGH" | "NORMAL" | "LOW"
}

export interface InvisibleLoss {
  id: string
  type: "EXPIRED" | "CASH_DIFF" | "THEFT" | "DAMAGED"
  amount: number
  description: string
  detectedAt: string
  estimatedValue: number
}

export interface DebtorAlert {
  clientId: string
  clientName: string
  totalOwed: number
  daysOverdue: number
  lastSaleDate: string | null
  alertLevel: "CRITICAL" | "WARNING" | "NORMAL"
}

// next-auth type extensions
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: string
      tenantId: string | null
      image?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    tenantId: string | null
  }
}
