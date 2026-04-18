import { Metadata } from "next"
import { db } from "@/lib/db"
import ProveedoresClient from "@/components/proveedores/ProveedoresClient"

export const metadata: Metadata = {
  title: "Proveedores | KioscoApp",
}

export default async function ProveedoresPage() {
  let suppliers: any[] = []

  try {
    suppliers = await db.supplier.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    })
  } catch {
    // DB not ready yet
  }

  return <ProveedoresClient initialSuppliers={suppliers} />
}
