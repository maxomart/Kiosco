import { Metadata } from "next"
import { db } from "@/lib/db"
import GastosClient from "@/components/gastos/GastosClient"

export const metadata: Metadata = {
  title: "Gastos | KioscoApp",
}

export default async function GastosPage() {
  let expenses: any[] = []
  let categories: any[] = []

  try {
    ;[expenses, categories] = await Promise.all([
      db.expense.findMany({
        orderBy: { createdAt: "desc" },
        include: { category: true },
        take: 200,
      }),
      db.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    ])
  } catch {
    // DB not ready yet
  }

  return <GastosClient initialExpenses={JSON.parse(JSON.stringify(expenses))} categories={categories} />
}
