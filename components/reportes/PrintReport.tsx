"use client"

interface PrintReportProps {
  data: any
  sales: any[]
  dateLabel: string
  period: "day" | "week" | "month"
}

export default function PrintReport({ data, sales, dateLabel, period }: PrintReportProps) {
  const PAYMENT_LABELS: Record<string, string> = {
    CASH: "Efectivo", DEBIT: "Débito", CREDIT: "Crédito",
    TRANSFER: "Transferencia", MERCADOPAGO: "MercadoPago",
    UALA: "Ualá", MODO: "Modo", MIXED: "Mixto",
  }

  const totalSales = sales.reduce((s, v) => s + v.total, 0)
  const completedSales = sales.filter(s => s.status === "COMPLETED")

  // Agrupar por método de pago
  const byMethod = completedSales.reduce((acc: any, s) => {
    const m = s.paymentMethod
    if (!acc[m]) acc[m] = { count: 0, total: 0 }
    acc[m].count++
    acc[m].total += s.total
    return acc
  }, {})

  const formatCurr = (n: number) => `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`

  return (
    <div id="print-report" style={{ fontFamily: "Arial, sans-serif", padding: "20px", maxWidth: "800px", margin: "0 auto", color: "#111" }}>
      <div style={{ textAlign: "center", borderBottom: "2px solid #111", paddingBottom: "12px", marginBottom: "20px" }}>
        <h1 style={{ margin: 0, fontSize: "24px" }}>KioscoApp — Reporte de Ventas</h1>
        <p style={{ margin: "4px 0 0", color: "#555", fontSize: "14px" }}>
          {period === "day" ? "Reporte diario" : period === "week" ? "Reporte semanal" : "Reporte mensual"} · {dateLabel}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        <div style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Total ventas</div>
          <div style={{ fontSize: "22px", fontWeight: "bold" }}>{formatCurr(totalSales)}</div>
        </div>
        <div style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Transacciones</div>
          <div style={{ fontSize: "22px", fontWeight: "bold" }}>{completedSales.length}</div>
        </div>
        <div style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Ticket promedio</div>
          <div style={{ fontSize: "22px", fontWeight: "bold" }}>{completedSales.length > 0 ? formatCurr(totalSales / completedSales.length) : "$0"}</div>
        </div>
      </div>

      <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "6px" }}>Por método de pago</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
        <thead>
          <tr style={{ backgroundColor: "#f5f5f5" }}>
            <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd" }}>Método</th>
            <th style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>Cantidad</th>
            <th style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(byMethod).map(([method, val]: any) => (
            <tr key={method}>
              <td style={{ padding: "8px", border: "1px solid #ddd" }}>{PAYMENT_LABELS[method] ?? method}</td>
              <td style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>{val.count}</td>
              <td style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd", fontWeight: "bold" }}>{formatCurr(val.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "6px" }}>Detalle de ventas</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ backgroundColor: "#f5f5f5" }}>
            <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid #ddd" }}>#</th>
            <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid #ddd" }}>Fecha/Hora</th>
            <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid #ddd" }}>Método</th>
            <th style={{ padding: "6px 8px", textAlign: "right", border: "1px solid #ddd" }}>Total</th>
            <th style={{ padding: "6px 8px", textAlign: "center", border: "1px solid #ddd" }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {sales.slice(0, 100).map((sale) => (
            <tr key={sale.id} style={{ backgroundColor: sale.status === "CANCELLED" ? "#fff5f5" : "white" }}>
              <td style={{ padding: "6px 8px", border: "1px solid #ddd" }}>#{sale.number}</td>
              <td style={{ padding: "6px 8px", border: "1px solid #ddd" }}>
                {new Date(sale.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </td>
              <td style={{ padding: "6px 8px", border: "1px solid #ddd" }}>{PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", border: "1px solid #ddd", fontWeight: "bold" }}>{formatCurr(sale.total)}</td>
              <td style={{ padding: "6px 8px", textAlign: "center", border: "1px solid #ddd", color: sale.status === "CANCELLED" ? "#dc2626" : "#16a34a" }}>
                {sale.status === "COMPLETED" ? "✓" : sale.status === "CANCELLED" ? "✗" : "↩"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: "20px", fontSize: "11px", color: "#999", textAlign: "center", borderTop: "1px solid #eee", paddingTop: "10px" }}>
        Generado el {new Date().toLocaleString("es-AR")} · KioscoApp
      </div>
    </div>
  )
}
