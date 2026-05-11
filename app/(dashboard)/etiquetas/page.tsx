"use client"

import { useEffect, useMemo, useState } from "react"
import { Tag, Search, Printer, Plus, Minus, Layers, Bluetooth, Usb, Zap, X as XIcon } from "lucide-react"
import toast from "react-hot-toast"
import { formatCurrency } from "@/lib/utils"
import { Barcode } from "@/components/etiquetas/Barcode"
import {
  connectBluetooth,
  connectUSB,
  isBluetoothSupported,
  isUSBSupported,
  type ConnectedPrinter,
} from "@/lib/thermal-printer"
import { buildLabelsBatch } from "@/lib/escpos"

interface ProductLite {
  id: string
  name: string
  barcode: string | null
  sku: string | null
  salePrice: number
  categoryName: string | null
}

type Size = "small" | "medium" | "large" | "ticket58" | "ticket80"

interface SizePreset {
  name: string
  w: string
  h: string
  barcodeH: number
  barcodeW: number
  nameSize: string
  priceSize: string
  /** Si está en true, el preset es para impresora térmica de tickets
   *  (rollo continuo, no etiquetas die-cut). Cambia el CSS @page para
   *  no asumir tamaño de hoja A4 y dejar que la impresora corte/avance
   *  entre tickets. */
  isThermalTicket?: boolean
}

const SIZE_PRESETS: Record<Size, SizePreset> = {
  // Etiquetas adhesivas (rollo die-cut tradicional: Xprinter, Brother QL, Zebra)
  small: { name: "Chica (40 × 25mm)", w: "40mm", h: "25mm", barcodeH: 22, barcodeW: 1.0, nameSize: "8px", priceSize: "11px" },
  medium: { name: "Mediana (60 × 35mm)", w: "60mm", h: "35mm", barcodeH: 30, barcodeW: 1.3, nameSize: "10px", priceSize: "14px" },
  large: { name: "Grande (80 × 50mm)", w: "80mm", h: "50mm", barcodeH: 40, barcodeW: 1.6, nameSize: "12px", priceSize: "18px" },
  // Impresoras térmicas de tickets — la mayoría de los kiosqueros usan estas
  // (Xprinter XP-58/80, EPSON TM-T20, 3nStar, etc.). Imprimen en rollo
  // continuo sin separación, una etiqueta por "ticket". El usuario corta
  // manual o la impresora avanza papel automático según config.
  ticket58: { name: "Ticket térmico 58mm", w: "48mm", h: "auto", barcodeH: 28, barcodeW: 1.1, nameSize: "10px", priceSize: "16px", isThermalTicket: true },
  ticket80: { name: "Ticket térmico 80mm", w: "70mm", h: "auto", barcodeH: 36, barcodeW: 1.4, nameSize: "12px", priceSize: "20px", isThermalTicket: true },
}

export default function EtiquetasPage() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ProductLite[]>([])
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [size, setSize] = useState<Size>("medium")
  const [showPrice, setShowPrice] = useState(true)
  const [showBusinessName, setShowBusinessName] = useState(true)
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [printer, setPrinter] = useState<ConnectedPrinter | null>(null)
  const [printing, setPrinting] = useState(false)
  const [connecting, setConnecting] = useState<"bluetooth" | "usb" | null>(null)
  const btSupported = typeof window !== "undefined" && isBluetoothSupported()
  const usbSupported = typeof window !== "undefined" && isUSBSupported()

  useEffect(() => {
    fetch("/api/etiquetas/products", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setProducts(d.products)
          setBusinessName(d.businessName)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode?.includes(q) ||
        p.sku?.toLowerCase().includes(q),
    )
  }, [products, search])

  const totalLabels = Object.values(selected).reduce((s, n) => s + n, 0)

  // Lista expandida de etiquetas a imprimir (cada producto repetido N veces)
  const labelsToRender = useMemo(() => {
    const list: ProductLite[] = []
    for (const p of products) {
      const qty = selected[p.id] ?? 0
      for (let i = 0; i < qty; i++) list.push(p)
    }
    return list
  }, [products, selected])

  const setQty = (id: string, n: number) =>
    setSelected((prev) => {
      const next = { ...prev }
      if (n <= 0) delete next[id]
      else next[id] = Math.min(500, n)
      return next
    })

  const addAllVisible = () => {
    setSelected((prev) => {
      const next = { ...prev }
      for (const p of filtered) {
        if (!next[p.id]) next[p.id] = 1
      }
      return next
    })
  }

  const clear = () => setSelected({})

  const handlePrint = () => {
    if (totalLabels === 0) {
      toast.error("Elegí al menos un producto")
      return
    }
    window.print()
  }

  /** Conectar a impresora térmica por Bluetooth o USB. Se hace una sola vez,
   *  después cada impresión es instantánea (sin diálogo). */
  const handleConnect = async (kind: "bluetooth" | "usb") => {
    setConnecting(kind)
    try {
      const p = kind === "bluetooth" ? await connectBluetooth() : await connectUSB()
      setPrinter(p)
      toast.success(`Impresora ${p.name} conectada`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo conectar"
      // Si el usuario cerró el picker del navegador no es un error real
      if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("user")) {
        toast.error(msg)
      }
    } finally {
      setConnecting(null)
    }
  }

  /** Impresión directa via ESC/POS (sin diálogo del navegador). */
  const handleDirectPrint = async () => {
    if (!printer) {
      toast.error("Conectá primero una impresora")
      return
    }
    if (totalLabels === 0) {
      toast.error("Elegí al menos un producto")
      return
    }
    setPrinting(true)
    try {
      const data = buildLabelsBatch(
        labelsToRender.map((p) => ({
          productName: p.name,
          price: formatCurrency(p.salePrice),
          barcode: p.barcode ?? p.sku ?? null,
          businessName: showBusinessName ? businessName : null,
        })),
      )
      await printer.print(data)
      toast.success(`${totalLabels} etiqueta${totalLabels > 1 ? "s" : ""} enviada${totalLabels > 1 ? "s" : ""}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al imprimir"
      toast.error(msg)
    } finally {
      setPrinting(false)
    }
  }

  const handleDisconnect = async () => {
    if (printer) {
      await printer.disconnect()
      setPrinter(null)
      toast.success("Impresora desconectada")
    }
  }

  const preset = SIZE_PRESETS[size]

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="h-32 bg-gray-900 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header — oculto en print */}
      <div className="print:hidden flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-900/40 border border-violet-700/40 flex items-center justify-center">
          <Tag className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Etiquetas para imprimir</h1>
          <p className="text-sm text-gray-400">
            Seleccioná productos, configurá el tamaño y mandá a imprimir.
          </p>
        </div>
      </div>

      {/* Configuración — oculto en print */}
      <section className="print:hidden grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista de productos */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código o SKU…"
              className="flex-1 bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-purple-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
            <button
              onClick={addAllVisible}
              className="text-xs px-3 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-700/40"
            >
              + Todos
            </button>
            {totalLabels > 0 && (
              <button
                onClick={clear}
                className="text-xs px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="max-h-[480px] overflow-y-auto -mx-2 px-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500 italic text-center py-8">
                {products.length === 0 ? "No hay productos cargados." : "Nada coincide con la búsqueda."}
              </p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((p) => {
                  const qty = selected[p.id] ?? 0
                  const hasCode = !!p.barcode || !!p.sku
                  return (
                    <li
                      key={p.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        qty > 0
                          ? "bg-purple-950/30 border border-purple-700/30"
                          : "bg-gray-800/40 border border-transparent hover:border-gray-700"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-100 truncate">{p.name}</p>
                        <p className="text-[11px] text-gray-500 flex items-center gap-2">
                          {p.categoryName && <span>{p.categoryName}</span>}
                          <span className="font-mono">{p.barcode ?? p.sku ?? "(sin código)"}</span>
                          <span className="text-gray-400">{formatCurrency(p.salePrice)}</span>
                        </p>
                      </div>
                      {!hasCode && (
                        <span className="text-[10px] text-amber-400" title="Sin código — no se va a imprimir el barcode">
                          ⚠
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setQty(p.id, qty - 1)}
                          disabled={qty === 0}
                          className="w-7 h-7 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 flex items-center justify-center"
                          aria-label="Restar"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          value={qty}
                          onChange={(e) => setQty(p.id, parseInt(e.target.value) || 0)}
                          min={0}
                          max={500}
                          className="w-12 bg-gray-800 border border-gray-700 rounded-md text-center text-sm text-white py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        <button
                          onClick={() => setQty(p.id, qty + 1)}
                          className="w-7 h-7 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center"
                          aria-label="Sumar"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Panel de configuración + acción */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">
              Tamaño
            </label>
            <div className="space-y-1.5">
              {(Object.keys(SIZE_PRESETS) as Size[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    size === s
                      ? "bg-purple-600/20 border border-purple-500/40 text-purple-100"
                      : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"
                  }`}
                >
                  {SIZE_PRESETS[s].name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">
              Mostrar
            </label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="w-4 h-4 accent-purple-500"
                />
                Precio
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBusinessName}
                  onChange={(e) => setShowBusinessName(e.target.checked)}
                  className="w-4 h-4 accent-purple-500"
                />
                Nombre del negocio
              </label>
            </div>
          </div>

          <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Layers size={12} />
              <span className="uppercase tracking-wider font-bold">Total a imprimir</span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{totalLabels}</p>
          </div>

          {/* Impresión directa via Bluetooth/USB — instant print sin diálogo
              del navegador. Funciona en Chrome/Edge desktop + Chrome Android.
              iOS y Firefox: caer al modo diálogo de abajo. */}
          {printer ? (
            <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {printer.kind === "bluetooth" ? <Bluetooth className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <Usb className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  <span className="text-xs text-emerald-100 truncate">{printer.name}</span>
                </div>
                <button onClick={handleDisconnect} className="text-gray-500 hover:text-gray-200 flex-shrink-0" title="Desconectar">
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={handleDirectPrint}
                disabled={totalLabels === 0 || printing}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-emerald-900/30"
              >
                <Zap size={16} />
                {printing ? "Imprimiendo…" : `Imprimir directo${totalLabels > 0 ? ` (${totalLabels})` : ""}`}
              </button>
              <p className="text-[10px] text-emerald-200/60 text-center">
                Impresión instantánea — sin diálogo del navegador.
              </p>
            </div>
          ) : (
            (btSupported || usbSupported) && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                  Conectar impresora térmica
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {btSupported && (
                    <button
                      onClick={() => handleConnect("bluetooth")}
                      disabled={connecting !== null}
                      className="flex items-center justify-center gap-1.5 py-2 px-2 bg-sky-900/30 hover:bg-sky-900/50 border border-sky-700/40 disabled:opacity-50 text-sky-200 text-xs font-medium rounded-lg transition-colors"
                    >
                      <Bluetooth className="w-3.5 h-3.5" />
                      {connecting === "bluetooth" ? "Buscando…" : "Bluetooth"}
                    </button>
                  )}
                  {usbSupported && (
                    <button
                      onClick={() => handleConnect("usb")}
                      disabled={connecting !== null}
                      className="flex items-center justify-center gap-1.5 py-2 px-2 bg-violet-900/30 hover:bg-violet-900/50 border border-violet-700/40 disabled:opacity-50 text-violet-200 text-xs font-medium rounded-lg transition-colors"
                    >
                      <Usb className="w-3.5 h-3.5" />
                      {connecting === "usb" ? "Buscando…" : "USB"}
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 text-center">
                  Una vez conectada, las impresiones son instantáneas.
                </p>
              </div>
            )
          )}

          {/* Fallback / alternativa: print dialog del navegador. Siempre
              disponible — útil para iOS, Firefox, o quien quiera previsualizar. */}
          <div className="pt-3 border-t border-gray-800 space-y-2">
            {printer && (
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                Alternativa: diálogo del navegador
              </p>
            )}
            <button
              onClick={handlePrint}
              disabled={totalLabels === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:opacity-40 text-gray-200 text-sm font-medium rounded-lg transition-colors"
            >
              <Printer size={14} />
              Imprimir con diálogo {totalLabels > 0 ? `(${totalLabels})` : ""}
            </button>
            <p className="text-[10px] text-gray-500 text-center">
              Tip: en el diálogo, desactivá márgenes y "encabezados/pies".
            </p>
          </div>
        </div>
      </section>

      {/* Hoja de etiquetas — visible en pantalla solo si hay seleccionadas, y siempre en print */}
      {totalLabels > 0 && (
        <section className="print:p-0 print:m-0 bg-white text-black p-4 rounded-xl border border-gray-200 print:border-none print:rounded-none">
          <div
            className="flex flex-wrap gap-1 print:gap-0 justify-start"
            id="labels-sheet"
          >
            {labelsToRender.map((p, idx) => (
              <div
                key={`${p.id}-${idx}`}
                className="border border-dashed border-gray-300 print:border-gray-200 flex flex-col items-center justify-between py-1 px-2 break-inside-avoid"
                style={{ width: preset.w, height: preset.h, fontSize: preset.nameSize }}
              >
                {showBusinessName && businessName && (
                  <p className="text-[7px] uppercase tracking-wider text-gray-600 truncate w-full text-center leading-tight">
                    {businessName}
                  </p>
                )}
                <p
                  className="font-semibold text-center leading-tight w-full overflow-hidden"
                  style={{ fontSize: preset.nameSize, lineHeight: 1.1, maxHeight: "2.4em" }}
                >
                  {p.name}
                </p>
                {(p.barcode || p.sku) && (
                  <Barcode
                    value={p.barcode ?? p.sku ?? ""}
                    height={preset.barcodeH}
                    width={preset.barcodeW}
                    fontSize={9}
                  />
                )}
                {showPrice && (
                  <p className="font-bold tabular-nums" style={{ fontSize: preset.priceSize }}>
                    {formatCurrency(p.salePrice)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <style jsx global>{`
        @media print {
          @page {
            /* En modo ticket térmico: la "página" es del ancho del rollo
               (58mm o 80mm) y la altura es auto — la impresora corta o
               avanza papel automático entre tickets. En modo etiqueta
               adhesiva tradicional usamos hoja A4 con margen. */
            ${preset.isThermalTicket
              ? `size: ${size === "ticket58" ? "58mm auto" : "80mm auto"}; margin: 0;`
              : "margin: 6mm;"}
          }
          body { background: white !important; }
          /* Ocultar nav/sidebar/etc */
          aside, nav, header, footer, [role="banner"] {
            display: none !important;
          }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:m-0 { margin: 0 !important; }
          .print\\:gap-0 { gap: 0 !important; }
          .print\\:border-none { border: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          .print\\:border-gray-200 { border-color: #e5e7eb !important; }
          ${preset.isThermalTicket
            ? `
            /* Ticket térmico: cada etiqueta es un "ticket" individual.
               Forzamos page-break después de cada item así la impresora
               corta/avanza entre cada uno. No queremos varios apilados
               en la misma tira. */
            #labels-sheet { flex-direction: column !important; gap: 0 !important; }
            #labels-sheet > div {
              page-break-after: always;
              break-after: page;
              border: none !important;
              padding: 4mm 2mm !important;
              width: 100% !important;
            }
            #labels-sheet > div:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            `
            : ""}
        }
      `}</style>
    </div>
  )
}
