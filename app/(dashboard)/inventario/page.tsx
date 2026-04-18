import { Metadata } from "next"
import { db } from "@/lib/db"
import InventarioClient from "@/components/inventario/InventarioClient"

export const metadata: Metadata = {
  title: "Inventario | KioscoApp",
}

export default async function InventarioPage() {
  const [products, categories, suppliers] = await Promise.all([
    db.product.findMany({
      include: { category: true, supplier: true },
      orderBy: { name: "asc" },
    }),
    db.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ])

  return (
    <InventarioClient
      initialProducts={JSON.parse(JSON.stringify(products))}
      categories={JSON.parse(JSON.stringify(categories))}
      suppliers={JSON.parse(JSON.stringify(suppliers))}
    />
  )
}
