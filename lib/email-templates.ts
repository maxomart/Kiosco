/**
 * Email templates for tenant notifications.
 * All templates are inline-styled HTML (table-based) for max client compatibility.
 */

interface DigestData {
  businessName: string
  periodLabel: string  // "23 de abril de 2026" or "Semana del 17 al 23 de abril"
  revenue: number
  profit: number
  salesCount: number
  itemsSold: number
  avgTicket: number
  expenses: number
  netProfit: number
  // Comparison vs previous period
  comparison?: {
    revenue: number  // % change
    profit: number
    salesCount: number
  }
  topProducts: Array<{ name: string; qty: number; revenue: number }>
  byMethod: Array<{ method: string; total: number; count: number }>
  // Optional AI-generated insights paragraph
  aiSummary?: string
  aiHighlights?: string[]
  aiRecommendations?: string[]
  // Visual
  brandColor?: string  // hex like "#8b5cf6"
  appUrl?: string      // base URL for deep links
}

const METHOD_LABELS: Record<string, string> = {
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

function fmtARS(n: number, decimals = 0): string {
  return "$ " + n.toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : ""
  return `${sign}${n.toFixed(1)}%`
}

function changeColor(n: number): string {
  if (n > 0.5) return "#10b981" // emerald
  if (n < -0.5) return "#ef4444" // red
  return "#9ca3af" // gray
}

function changeArrow(n: number): string {
  if (n > 0.5) return "↗"
  if (n < -0.5) return "↘"
  return "→"
}

/**
 * Daily / weekly / monthly summary email.
 */
export function renderDigestEmail(d: DigestData): string {
  const accent = d.brandColor ?? "#8b5cf6"
  const cmp = d.comparison
  const profitMargin = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Reporte ${d.periodLabel} — ${d.businessName}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0f172a;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#111827;border-radius:16px;overflow:hidden;">

      <!-- Header -->
      <tr><td style="padding:32px 32px 24px 32px;background:linear-gradient(135deg, ${accent}33 0%, ${accent}11 100%);border-bottom:1px solid #1f2937;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${d.businessName}</td>
            <td align="right" style="font-size:11px;color:#6b7280;">${d.periodLabel}</td>
          </tr>
          <tr><td colspan="2" style="padding-top:8px;">
            <h1 style="margin:0;font-size:24px;color:#f9fafb;font-weight:700;">📊 Reporte de ventas</h1>
          </td></tr>
        </table>
      </td></tr>

      <!-- Top KPI: Revenue -->
      <tr><td style="padding:24px 32px 8px 32px;">
        <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Ingresos</p>
        <p style="margin:4px 0 0 0;font-size:36px;color:#f9fafb;font-weight:800;">${fmtARS(d.revenue)}</p>
        ${cmp ? `<p style="margin:4px 0 0 0;font-size:13px;color:${changeColor(cmp.revenue)};font-weight:600;">${changeArrow(cmp.revenue)} ${fmtPct(cmp.revenue)} vs período anterior</p>` : ""}
      </td></tr>

      <!-- KPI Grid -->
      <tr><td style="padding:16px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="33%" style="background:#1f2937;border-radius:12px;padding:14px;text-align:center;" valign="top">
              <p style="margin:0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Ventas</p>
              <p style="margin:6px 0 0 0;font-size:22px;color:#f9fafb;font-weight:700;">${d.salesCount}</p>
              ${cmp ? `<p style="margin:2px 0 0 0;font-size:11px;color:${changeColor(cmp.salesCount)};">${fmtPct(cmp.salesCount)}</p>` : ""}
            </td>
            <td width="2%"></td>
            <td width="33%" style="background:#1f2937;border-radius:12px;padding:14px;text-align:center;" valign="top">
              <p style="margin:0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Ganancia</p>
              <p style="margin:6px 0 0 0;font-size:22px;color:#10b981;font-weight:700;">${fmtARS(d.profit)}</p>
              <p style="margin:2px 0 0 0;font-size:11px;color:#6b7280;">Margen ${profitMargin.toFixed(0)}%</p>
            </td>
            <td width="2%"></td>
            <td width="33%" style="background:#1f2937;border-radius:12px;padding:14px;text-align:center;" valign="top">
              <p style="margin:0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Ticket prom.</p>
              <p style="margin:6px 0 0 0;font-size:22px;color:#f9fafb;font-weight:700;">${fmtARS(d.avgTicket)}</p>
              <p style="margin:2px 0 0 0;font-size:11px;color:#6b7280;">${d.itemsSold} unid.</p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Net profit (if expenses) -->
      ${d.expenses > 0 ? `
      <tr><td style="padding:8px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(90deg, #064e3b 0%, #022c22 100%);border:1px solid #047857;border-radius:12px;">
          <tr><td style="padding:14px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td>
                  <p style="margin:0;font-size:10px;color:#6ee7b7;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Ganancia neta</p>
                  <p style="margin:2px 0 0 0;font-size:11px;color:#9ca3af;">${fmtARS(d.profit)} bruta − ${fmtARS(d.expenses)} gastos</p>
                </td>
                <td align="right">
                  <p style="margin:0;font-size:24px;color:${d.netProfit >= 0 ? "#34d399" : "#ef4444"};font-weight:800;">${d.netProfit >= 0 ? "+" : ""}${fmtARS(d.netProfit)}</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
      ` : ""}

      ${d.aiSummary ? `
      <!-- AI Insights -->
      <tr><td style="padding:16px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg, ${accent}22 0%, ${accent}08 100%);border:1px solid ${accent}55;border-radius:12px;">
          <tr><td style="padding:18px;">
            <p style="margin:0 0 8px 0;font-size:11px;color:${accent};text-transform:uppercase;letter-spacing:1px;font-weight:700;">✨ Análisis del período</p>
            <p style="margin:0;font-size:14px;color:#e5e7eb;line-height:1.6;">${d.aiSummary}</p>
            ${d.aiHighlights && d.aiHighlights.length > 0 ? `
              <p style="margin:14px 0 6px 0;font-size:11px;color:#6ee7b7;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Destacado</p>
              <ul style="margin:0;padding-left:18px;color:#d1d5db;font-size:13px;line-height:1.7;">
                ${d.aiHighlights.map(h => `<li>${h}</li>`).join("")}
              </ul>
            ` : ""}
            ${d.aiRecommendations && d.aiRecommendations.length > 0 ? `
              <p style="margin:14px 0 6px 0;font-size:11px;color:#fbbf24;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Recomendaciones</p>
              <ul style="margin:0;padding-left:18px;color:#d1d5db;font-size:13px;line-height:1.7;">
                ${d.aiRecommendations.map(r => `<li>${r}</li>`).join("")}
              </ul>
            ` : ""}
          </td></tr>
        </table>
      </td></tr>
      ` : ""}

      <!-- Top Products -->
      ${d.topProducts.length > 0 ? `
      <tr><td style="padding:16px 32px;">
        <p style="margin:0 0 12px 0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Top productos</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${d.topProducts.slice(0, 5).map((p, i) => `
            <tr><td style="padding:8px 0;border-bottom:1px solid #1f2937;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="32" valign="middle">
                    <span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:${accent}33;color:${accent};text-align:center;line-height:24px;font-size:11px;font-weight:700;">${i + 1}</span>
                  </td>
                  <td valign="middle">
                    <p style="margin:0;font-size:14px;color:#f9fafb;font-weight:500;">${escapeHtml(p.name)}</p>
                    <p style="margin:0;font-size:11px;color:#6b7280;">${p.qty} unid.</p>
                  </td>
                  <td align="right" valign="middle">
                    <p style="margin:0;font-size:14px;color:#f9fafb;font-weight:600;">${fmtARS(p.revenue)}</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          `).join("")}
        </table>
      </td></tr>
      ` : ""}

      <!-- Payment methods -->
      ${d.byMethod.length > 0 ? `
      <tr><td style="padding:16px 32px;">
        <p style="margin:0 0 12px 0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Métodos de pago</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${d.byMethod.map((m) => {
            const pct = d.revenue > 0 ? (m.total / d.revenue) * 100 : 0
            return `
            <tr><td style="padding:6px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td><p style="margin:0;font-size:13px;color:#d1d5db;">${METHOD_LABELS[m.method] ?? m.method}</p></td>
                  <td align="right" width="120"><p style="margin:0;font-size:13px;color:#9ca3af;">${m.count} venta${m.count !== 1 ? "s" : ""}</p></td>
                  <td align="right" width="100"><p style="margin:0;font-size:13px;color:#f9fafb;font-weight:500;">${fmtARS(m.total)}</p></td>
                  <td align="right" width="50"><p style="margin:0;font-size:11px;color:#6b7280;">${pct.toFixed(0)}%</p></td>
                </tr>
              </table>
            </td></tr>
            `
          }).join("")}
        </table>
      </td></tr>
      ` : ""}

      <!-- CTA -->
      ${d.appUrl ? `
      <tr><td style="padding:24px 32px;" align="center">
        <a href="${d.appUrl}/reportes" style="display:inline-block;padding:14px 32px;background:${accent};color:#fff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Ver reportes completos →</a>
      </td></tr>
      ` : ""}

      <!-- Footer -->
      <tr><td style="padding:20px 32px;background:#0f172a;border-top:1px solid #1f2937;">
        <p style="margin:0;font-size:11px;color:#6b7280;text-align:center;line-height:1.6;">
          Recibís este email porque activaste resúmenes en tu negocio.<br />
          ${d.appUrl ? `<a href="${d.appUrl}/configuracion" style="color:${accent};text-decoration:none;">Cambiar preferencias</a> · ` : ""}
          <span>Respondé este email para contactarnos</span>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

/**
 * Low stock alert email — short, actionable.
 */
export function renderLowStockEmail(opts: {
  businessName: string
  brandColor?: string
  appUrl?: string
  products: Array<{ name: string; stock: number; minStock: number; categoryName?: string | null }>
}): string {
  const accent = opts.brandColor ?? "#8b5cf6"

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#0f172a;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:32px 16px;background:#0f172a;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#111827;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:24px 32px;background:linear-gradient(135deg, #f59e0b22, #f59e0b08);border-bottom:1px solid #1f2937;">
        <p style="margin:0;font-size:12px;color:#fbbf24;text-transform:uppercase;letter-spacing:1px;font-weight:700;">⚠ Stock bajo</p>
        <h1 style="margin:6px 0 0 0;font-size:22px;color:#f9fafb;font-weight:700;">${opts.products.length} producto${opts.products.length !== 1 ? "s" : ""} necesita${opts.products.length !== 1 ? "n" : ""} reposición</h1>
      </td></tr>
      <tr><td style="padding:20px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${opts.products.slice(0, 20).map((p) => `
          <tr><td style="padding:10px 0;border-bottom:1px solid #1f2937;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td>
                  <p style="margin:0;font-size:14px;color:#f9fafb;font-weight:500;">${escapeHtml(p.name)}</p>
                  ${p.categoryName ? `<p style="margin:2px 0 0 0;font-size:11px;color:#6b7280;">${escapeHtml(p.categoryName)}</p>` : ""}
                </td>
                <td align="right">
                  <p style="margin:0;font-size:14px;color:${p.stock === 0 ? "#ef4444" : "#fbbf24"};font-weight:700;">
                    ${p.stock === 0 ? "Sin stock" : `${p.stock} / ${p.minStock} mín.`}
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
          `).join("")}
        </table>
      </td></tr>
      ${opts.appUrl ? `
      <tr><td style="padding:0 32px 28px 32px;" align="center">
        <a href="${opts.appUrl}/inventario?filter=lowstock" style="display:inline-block;padding:12px 28px;background:${accent};color:#fff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Ver inventario completo →</a>
      </td></tr>
      ` : ""}
      <tr><td style="padding:16px 32px;background:#0f172a;border-top:1px solid #1f2937;text-align:center;">
        <p style="margin:0;font-size:11px;color:#6b7280;">${opts.businessName}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!))
}
