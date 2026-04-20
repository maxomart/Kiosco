import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Receipt } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import VentaDetalleClient from "./VentaDetalleClient"

export default async function VentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-gray-400">Iniciá sesión para ver esta venta.</p>
      </div>
    )
  }

  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      items: true,
      user: { select: { name: true } },
      client: { select: { name: true, condicionIVA: true, docNumber: true, docType: true } },
    },
  })
  if (!sale) return notFound()
  if (session.user.role !== "SUPER_ADMIN" && sale.tenantId !== session.user.tenantId) return notFound()

  const canIssue = session.user.role === "OWNER" || session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN"

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <Link
        href="/ventas"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <ArrowLeft size={14} /> Volver a ventas
      </Link>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-900/30 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Venta #{sale.number}</h1>
              <p className="text-xs text-gray-500">
                {sale.createdAt.toLocaleString("es-AR")} · {sale.user?.name ?? "—"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-2xl font-bold text-white">$ {Number(sale.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="mt-5 border-t border-gray-800 pt-4 space-y-1 text-sm">
          <p className="text-gray-400">Cliente: <span className="text-gray-200">{sale.client?.name ?? "Consumidor Final"}</span></p>
          <p className="text-gray-400">Método de pago: <span className="text-gray-200">{sale.paymentMethod}</span></p>
        </div>

        <div className="mt-4 space-y-1 text-sm">
          {sale.items.map((it) => (
            <div key={it.id} className="flex justify-between text-gray-300">
              <span>{it.quantity}× {it.productName}</span>
              <span>$ {Number(it.subtotal).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
        </div>
      </div>

      <VentaDetalleClient
        saleId={sale.id}
        initialStatus={{
          cae: sale.cae,
          caeExpiresAt: sale.caeExpiresAt ? sale.caeExpiresAt.toISOString() : null,
          invoiceNumber: sale.invoiceNumber,
          invoiceType: sale.invoiceType,
          pointOfSale: sale.pointOfSale,
          afipStatus: sale.afipStatus,
          afipError: sale.afipError,
        }}
        canIssue={canIssue}
      />
    </div>
  )
}
