import { Metadata } from "next"
import { db } from "@/lib/db"
import ClientesClient from "@/components/clientes/ClientesClient"

export const metadata: Metadata = {
  title: "Clientes | KioscoApp",
}

export default async function ClientesPage() {
  let clients: any[] = []

  try {
    clients = await db.client.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    })
  } catch {
    // DB not ready yet
  }

  return <ClientesClient initialClients={clients} />
}
