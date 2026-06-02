"use client"

import { useState, useEffect, useMemo, useRef, type ReactNode } from "react"
import {
  Calculator,
  Camera,
  Sparkles,
  Plus,
  X,
  Trash2,
  Save,
  FilePlus2,
  Printer,
  Download,
  ExternalLink,
  History,
  Heart,
} from "lucide-react"
import toast from "react-hot-toast"
import { cn } from "@/lib/utils"

// ── tipos ────────────────────────────────────────────────────────────────
type Row = { concepto: string; monto: string }
type Propina = { concepto: string; monto: string; personas: string }
type Form = {
  fecha: string
  numeroZ: string
  ticketsZ: string
  ticketsAB: string
  importeZ: string
  facturasAB: string
  salonMonto: string
  salonCub: string
  takeMonto: string
  takeCub: string
  otroMonto: string
  otroCub: string
  saldoAnterior: string
  efectivo: Row[]
  gastos: Row[]
  retiros: Row[]
  propinas: Propina[]
  cierreHecho: boolean
  notas: string
}
type RowSection = "efectivo" | "gastos" | "retiros"
type Calc = ReturnType<typeof compute>
type Saved = { id: number; savedAt: string; form: Form; calc: Calc }

const HKEY = "orvex_cierres_v1"

// ── mensajitos de amor al cerrar la caja ❤️ ─────────────────────────────────
const PET_NAMES = ["mi amor", "mi bb", "mi vida", "hermosa", "mi reina", "bebé", "mi cielo"]
const LOVE_MSGS: Record<"exacto" | "cerca" | "lejos", string[]> = {
  exacto: [
    "¡Cuadró justo, {p}! Sos una genia ❤️",
    "Caja impecable, {p} ❤️ te amo",
    "¡Cero diferencia, {p}! La mejor del mundo ❤️",
    "Perfecto, {p} ❤️ te re amo",
  ],
  cerca: [
    "Estuviste cerquísima, {p} ❤️ por monedas",
    "Casi casi, {p} ❤️ buenísimo igual, te amo",
    "Re cerca, {p} ❤️ sos una capa",
    "Por poquito, {p} ❤️ te amo un montón",
  ],
  lejos: [
    "No pasa nada, {p} ❤️ mañana lo clavás",
    "Tranqui, {p} ❤️ la caja es lo de menos, te amo",
    "Igual sos la mejor, {p} ❤️ te amo",
    "Pasa, {p} ❤️ te amo igual, dé lo que dé",
  ],
}
const pickOne = (a: string[]) => a[Math.floor(Math.random() * a.length)]
function loveMessage(diferencia: number, esperado: number): string {
  const abs = Math.abs(Math.round(diferencia))
  const umbral = Math.max(2000, esperado * 0.01)
  const tier = abs === 0 ? "exacto" : abs <= umbral ? "cerca" : "lejos"
  return pickOne(LOVE_MSGS[tier]).replace("{p}", pickOne(PET_NAMES))
}

// ── helpers puros ──────────────────────────────────────────────────────────
// Igual que en la herramienta original: limpia $, espacios y separador de miles
// (punto), y toma la coma como decimal. "$ 560.300" → 560300, "1.234,50" → 1234.5
function parseNum(v: string): number {
  if (typeof v !== "string") v = String(v ?? "")
  v = v.trim()
  if (!v) return 0
  v = v.replace(/\s/g, "").replace(/\$/g, "").replace(/\./g, "").replace(/,/g, ".")
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}
const fmtFull = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const fmt = (n: number) => fmtFull.format(n || 0)
const sum = (rows: { monto: string }[]) => rows.reduce((a, r) => a + parseNum(r.monto), 0)

function compute(f: Form) {
  const importeZ = parseNum(f.importeZ)
  const facturasAB = parseNum(f.facturasAB)
  const esperado = importeZ + facturasAB
  const saldoDia = sum(f.efectivo)
  const totalGastos = sum(f.gastos)
  const totalRetiros = sum(f.retiros)
  const egresos = totalGastos + totalRetiros
  const saldoAnterior = parseNum(f.saldoAnterior)
  const sumaTotal = egresos + saldoDia
  const total = sumaTotal - saldoAnterior
  const diferencia = total - esperado
  const detalle = parseNum(f.salonMonto) + parseNum(f.takeMonto) + parseNum(f.otroMonto)
  const detalleMismatch = detalle > 0 && Math.round(detalle) !== Math.round(esperado)
  const totalPropinas = f.propinas.reduce((a, p) => a + parseNum(p.monto), 0)
  return {
    importeZ, facturasAB, esperado, saldoDia, totalGastos, totalRetiros, egresos,
    saldoAnterior, sumaTotal, total, diferencia, detalle, detalleMismatch, totalPropinas,
  }
}

function normFecha(f: any): string {
  if (!f) return ""
  const s = String(f)
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s)
  if (m) {
    let y = m[3]
    if (y.length === 2) y = "20" + y
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  }
  return ""
}

function todayLocal(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function emptyForm(): Form {
  return {
    fecha: todayLocal(),
    numeroZ: "", ticketsZ: "", ticketsAB: "",
    importeZ: "", facturasAB: "",
    salonMonto: "", salonCub: "", takeMonto: "", takeCub: "", otroMonto: "", otroCub: "",
    saldoAnterior: "",
    efectivo: [{ concepto: "Caja", monto: "" }, { concepto: "Bolsa", monto: "" }],
    gastos: [{ concepto: "", monto: "" }],
    retiros: [{ concepto: "Tarjeta (TD)", monto: "" }, { concepto: "Mercado Pago", monto: "" }],
    propinas: [{ concepto: "", monto: "", personas: "" }],
    cierreHecho: false,
    notas: "",
  }
}

// Reduce tamaño antes de subir: máx 1600px lado mayor, JPEG 0.85 → menos tokens.
function toDataURL(file: File, max = 1600): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const w = img.width
      const h = img.height
      const s = Math.min(1, max / Math.max(w, h))
      const cw = Math.round(w * s)
      const ch = Math.round(h * s)
      const c = document.createElement("canvas")
      c.width = cw
      c.height = ch
      c.getContext("2d")?.drawImage(img, 0, 0, cw, ch)
      URL.revokeObjectURL(url)
      res(c.toDataURL("image/jpeg", 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      rej(new Error("No se pudo leer la imagen"))
    }
    img.src = url
  })
}

// ── estilos compartidos ────────────────────────────────────────────────────
const INPUT =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
const AMOUNT = cn(INPUT, "text-right tabular-nums font-semibold")

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 print:break-inside-avoid", className)}>
      {children}
    </section>
  )
}
function Title({ n, children, violet }: { n: ReactNode; children: ReactNode; violet?: boolean }) {
  return (
    <h2 className={cn("flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wide", violet ? "text-violet-300" : "text-purple-300")}>
      <span className={cn("w-5 h-5 rounded-full grid place-items-center text-white text-[11px] flex-none", violet ? "bg-violet-600" : "bg-purple-600")}>{n}</span>
      {children}
    </h2>
  )
}
function Label({ children }: { children: ReactNode }) {
  return <label className="block text-xs font-medium text-gray-400 mb-1">{children}</label>
}
function SumLine({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0", strong && "text-base")}>
      <span className={cn(strong ? "text-gray-100 font-bold" : "text-gray-400")}>{k}</span>
      <span className={cn("tabular-nums", strong ? "font-extrabold text-white" : "font-semibold text-gray-100")}>{v}</span>
    </div>
  )
}

// ── componente ──────────────────────────────────────────────────────────────
export default function CierrePage() {
  const [f, setF] = useState<Form>(emptyForm)
  const calc = useMemo(() => compute(f), [f])

  // mensajito de amor que aparece al guardar (cerrar la caja)
  const [love, setLove] = useState<string | null>(null)
  useEffect(() => {
    if (!love) return
    const t = setTimeout(() => setLove(null), 5000)
    return () => clearTimeout(t)
  }, [love])

  const [hist, setHist] = useState<Saved[]>([])
  useEffect(() => {
    try {
      setHist(JSON.parse(localStorage.getItem(HKEY) || "[]"))
    } catch {
      setHist([])
    }
  }, [])

  // ── IA: fotos ──
  const fileRef = useRef<HTMLInputElement>(null)
  const [imgs, setImgs] = useState<{ file: File; url: string }[]>([])
  const [drag, setDrag] = useState(false)
  const [iaLoading, setIaLoading] = useState(false)
  const [iaMsg, setIaMsg] = useState<{ text: string; kind: "ok" | "bad" | "wait" } | null>(null)

  const imgsRef = useRef(imgs)
  useEffect(() => {
    imgsRef.current = imgs
  }, [imgs])
  useEffect(() => () => imgsRef.current.forEach((x) => URL.revokeObjectURL(x.url)), [])

  // Evitar que el navegador abra la imagen si se suelta fuera de la zona.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault()
    window.addEventListener("dragover", prevent)
    window.addEventListener("drop", prevent)
    return () => {
      window.removeEventListener("dragover", prevent)
      window.removeEventListener("drop", prevent)
    }
  }, [])

  // ── setters de form ──
  const setField = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }))
  const addRow = (s: RowSection) => setF((p) => ({ ...p, [s]: [...p[s], { concepto: "", monto: "" }] }))
  const setRow = (s: RowSection, i: number, k: keyof Row, v: string) =>
    setF((p) => ({ ...p, [s]: p[s].map((r, j) => (j === i ? { ...r, [k]: v } : r)) }))
  const delRow = (s: RowSection, i: number) => setF((p) => ({ ...p, [s]: p[s].filter((_, j) => j !== i) }))
  const addProp = () => setF((p) => ({ ...p, propinas: [...p.propinas, { concepto: "", monto: "", personas: "" }] }))
  const setProp = (i: number, k: keyof Propina, v: string) =>
    setF((p) => ({ ...p, propinas: p.propinas.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }))
  const delProp = (i: number) => setF((p) => ({ ...p, propinas: p.propinas.filter((_, j) => j !== i) }))

  // ── IA: handlers ──
  const addFiles = (list: FileList | null): number => {
    if (!list) return 0
    const next: { file: File; url: string }[] = []
    for (const file of Array.from(list)) {
      if (file.type.startsWith("image/")) next.push({ file, url: URL.createObjectURL(file) })
    }
    if (next.length) setImgs((p) => [...p, ...next])
    return next.length
  }
  const removeImg = (i: number) =>
    setImgs((p) => {
      const x = p[i]
      if (x) URL.revokeObjectURL(x.url)
      return p.filter((_, j) => j !== i)
    })

  const numStr = (v: any): string | undefined =>
    v !== null && v !== undefined && v !== "" && !isNaN(Number(v)) ? String(v) : undefined

  const applyExtraction = (d: any) => {
    d = d || {}
    setF((prev) => {
      const next: Form = { ...prev }
      const fe = normFecha(d.fecha)
      if (fe) next.fecha = fe
      if (d.numeroZ != null && String(d.numeroZ).trim() !== "") next.numeroZ = String(d.numeroZ)
      const pairs: [keyof Form, any][] = [
        ["ticketsZ", d.ticketsZ], ["ticketsAB", d.ticketsAB],
        ["importeZ", d.importeZ], ["facturasAB", d.facturasAB],
        ["salonMonto", d.salonMonto], ["salonCub", d.salonCub],
        ["takeMonto", d.takeMonto], ["takeCub", d.takeCub],
        ["otroMonto", d.otroMonto], ["otroCub", d.otroCub],
        ["saldoAnterior", d.saldoAnterior],
      ]
      for (const [k, v] of pairs) {
        const s = numStr(v)
        if (s !== undefined) (next as any)[k] = s
      }
      const mapRows = (arr: any[]): Row[] =>
        arr.map((x) => ({ concepto: String(x?.concepto || ""), monto: x?.monto == null ? "" : String(x.monto) }))
      if (Array.isArray(d.efectivo) && d.efectivo.length) next.efectivo = mapRows(d.efectivo)
      if (Array.isArray(d.gastos) && d.gastos.length) next.gastos = mapRows(d.gastos)
      if (Array.isArray(d.retiros) && d.retiros.length) next.retiros = mapRows(d.retiros)
      if (Array.isArray(d.propinas) && d.propinas.length)
        next.propinas = d.propinas.map((p: any) => ({
          concepto: String(p?.concepto || ""),
          monto: p?.monto == null ? "" : String(p.monto),
          personas: p?.personas == null ? "" : String(p.personas),
        }))
      return next
    })
  }

  const leerFotos = async () => {
    if (!imgs.length) {
      setIaMsg({ text: "Elegí o sacá al menos una foto.", kind: "bad" })
      return
    }
    setIaLoading(true)
    setIaMsg({ text: "Leyendo con IA… tarda unos segundos.", kind: "wait" })
    try {
      const images = await Promise.all(imgs.map((x) => toDataURL(x.file)))
      const r = await fetch("/api/ai/cierre-vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`)
      applyExtraction(j.data)
      setIaMsg({ text: "Listo. Revisá los números antes de guardar.", kind: "ok" })
    } catch (e: any) {
      let m = e?.message || String(e)
      if (/failed to fetch|networkerror|load failed/i.test(m)) m = "No me pude conectar. Revisá tu internet."
      setIaMsg({ text: m, kind: "bad" })
    } finally {
      setIaLoading(false)
    }
  }

  // ── historial ──
  const readHist = (): Saved[] => {
    try {
      return JSON.parse(localStorage.getItem(HKEY) || "[]")
    } catch {
      return []
    }
  }
  const persist = (arr: Saved[]) => {
    localStorage.setItem(HKEY, JSON.stringify(arr))
    setHist(arr)
  }
  const saveCierre = () => {
    persist([...readHist(), { id: Date.now(), savedAt: new Date().toISOString(), form: f, calc }])
    setLove(loveMessage(calc.diferencia, calc.esperado))
  }
  const openCierre = (s: Saved) => {
    setF(s.form)
    window.scrollTo({ top: 0, behavior: "smooth" })
    toast("Cierre abierto")
  }
  const delCierre = (id: number) => {
    if (!window.confirm("¿Borrar este cierre del historial?")) return
    persist(readHist().filter((s) => s.id !== id))
    toast("Cierre borrado")
  }
  const nuevo = () => {
    if (!window.confirm("¿Empezar un cierre nuevo? Lo que no guardaste se pierde.")) return
    const base = emptyForm()
    const last = [...readHist()].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0]
    if (last) base.saldoAnterior = String(Math.round(last.calc.saldoDia))
    setF(base)
    setImgs([])
    setIaMsg(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const lastSaldo = useMemo(() => {
    const last = [...hist].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0]
    return last ? last.calc.saldoDia : null
  }, [hist])

  const exportCSV = () => {
    const arr = readHist()
    if (!arr.length) {
      toast.error("No hay cierres para exportar")
      return
    }
    const cols = [
      "fecha", "numeroZ", "ticketsZ", "ticketsAB", "importeZ", "facturasAB", "esperado",
      "saldoDia", "totalGastos", "totalRetiros", "egresos", "saldoAnterior", "sumaTotal",
      "total", "diferencia", "totalPropinas", "cierreHecho", "notas",
    ]
    const val = (s: Saved, k: string): string | number => {
      switch (k) {
        case "fecha": return s.form.fecha
        case "numeroZ": return s.form.numeroZ
        case "ticketsZ": return s.form.ticketsZ
        case "ticketsAB": return s.form.ticketsAB
        case "cierreHecho": return s.form.cierreHecho ? "si" : "no"
        case "notas": return s.form.notas
        default: return (s.calc as any)[k] ?? ""
      }
    }
    const esc = (v: any) => (typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v)
    const csv = "﻿" + cols.join(";") + "\n" + arr.map((s) => cols.map((k) => esc(val(s, k))).join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "cierres_caja.csv"
    a.click()
    toast.success("CSV exportado")
  }

  // ── diferencia ──
  const diff = Math.round(calc.diferencia)
  const diffOk = diff === 0
  const sortedHist = useMemo(() => [...hist].sort((a, b) => b.savedAt.localeCompare(a.savedAt)), [hist])

  return (
    <div className="max-w-3xl mx-auto pb-28">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Calculator className="w-5 h-5 text-purple-400" /> Cierre de caja
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Cargá los datos (o leélos de una foto) y las cuentas se hacen solas.</p>
      </div>

      {/* IA */}
      <Card className="border-violet-500/30 print:hidden">
        <Title n={<Sparkles className="w-3 h-3" />} violet>Cargar desde foto (IA)</Title>
        <p className="text-xs text-gray-400 mb-3">
          Sacá foto a la pantalla del sistema y/o a la planilla escrita y la IA completa los campos. Después revisás.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ""
            setIaMsg(null)
          }}
        />
        <div
          onClick={() => fileRef.current?.click()}
          onDragEnter={(e) => { e.preventDefault(); setDrag(true) }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={(e) => { e.preventDefault(); setDrag(false) }}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            const n = addFiles(e.dataTransfer.files)
            setIaMsg(n ? null : { text: "Eso no parece una imagen.", kind: "bad" })
          }}
          className={cn(
            "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors flex flex-col items-center gap-1",
            drag ? "border-violet-400 bg-violet-500/15 text-violet-200" : "border-violet-500/40 bg-violet-500/5 text-violet-300 hover:bg-violet-500/10"
          )}
        >
          <Camera className="w-7 h-7" />
          <div className="font-semibold text-sm">Tocá para sacar o elegir fotos</div>
          <div className="text-xs text-gray-400">o arrastralas acá — podés subir varias (pantalla + planilla)</div>
        </div>

        {imgs.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {imgs.map((x, i) => (
              <div key={x.url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImg(i)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 grid place-items-center rounded-full bg-black/70 text-white text-[10px]"
                  aria-label="Quitar foto"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={leerFotos}
          disabled={iaLoading}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-55 disabled:cursor-default text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          {iaLoading ? "Leyendo…" : "Leer y completar"}
        </button>
        {iaMsg && (
          <p
            className={cn(
              "mt-2 text-sm font-medium",
              iaMsg.kind === "ok" && "text-green-400",
              iaMsg.kind === "bad" && "text-red-400",
              iaMsg.kind === "wait" && "text-violet-300"
            )}
          >
            {iaMsg.text}
          </p>
        )}
      </Card>

      {/* 1. Datos del día */}
      <Card>
        <Title n={1}>Datos del día</Title>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fecha</Label>
            <input type="date" className={INPUT} value={f.fecha} onChange={(e) => setField("fecha", e.target.value)} />
          </div>
          <div>
            <Label>Número Z</Label>
            <input type="text" inputMode="numeric" placeholder="2309" className={INPUT} value={f.numeroZ} onChange={(e) => setField("numeroZ", e.target.value)} />
          </div>
          <div>
            <Label>Tickets fiscales (Z)</Label>
            <input type="text" inputMode="numeric" placeholder="52" className={INPUT} value={f.ticketsZ} onChange={(e) => setField("ticketsZ", e.target.value)} />
          </div>
          <div>
            <Label>Tickets Facturas A/B</Label>
            <input type="text" inputMode="numeric" placeholder="19" className={INPUT} value={f.ticketsAB} onChange={(e) => setField("ticketsAB", e.target.value)} />
          </div>
        </div>
      </Card>

      {/* 2. Sistema */}
      <Card>
        <Title n={2}>Datos del sistema (reporte Z)</Title>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Importe total del Z (fiscal)</Label>
            <input type="text" inputMode="decimal" placeholder="0" className={AMOUNT} value={f.importeZ} onChange={(e) => setField("importeZ", e.target.value)} />
          </div>
          <div>
            <Label>Facturas A y B (sin ticket)</Label>
            <input type="text" inputMode="decimal" placeholder="0" className={AMOUNT} value={f.facturasAB} onChange={(e) => setField("facturasAB", e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <SumLine k="Total ventas (esperado)" v={fmt(calc.esperado)} strong />
        </div>

        <div className="text-xs font-bold text-violet-300/80 mt-4 mb-2">Detalle (opcional)</div>
        {[
          ["Salón", "salonMonto", "salonCub"],
          ["Take away", "takeMonto", "takeCub"],
          ["Otro", "otroMonto", "otroCub"],
        ].map(([label, montoKey, cubKey]) => (
          <div key={montoKey} className="grid grid-cols-3 gap-3 mb-2">
            <div className="col-span-2">
              <Label>{label} ($)</Label>
              <input type="text" inputMode="decimal" placeholder="0" className={AMOUNT} value={(f as any)[montoKey]} onChange={(e) => setField(montoKey as keyof Form, e.target.value as any)} />
            </div>
            <div>
              <Label>Cubiertos</Label>
              <input type="text" inputMode="numeric" placeholder="0" className={INPUT} value={(f as any)[cubKey]} onChange={(e) => setField(cubKey as keyof Form, e.target.value as any)} />
            </div>
          </div>
        ))}
        {calc.detalleMismatch && (
          <p className="text-xs text-amber-400 font-medium mt-2">⚠ Salón + Take away + Otro no coincide con el total de ventas.</p>
        )}
      </Card>

      {/* 3. Efectivo */}
      <RowsCard
        n={3}
        title="Efectivo contado"
        hint="Lo que contás en la caja y en la bolsa."
        rows={f.efectivo}
        onAdd={() => addRow("efectivo")}
        onSet={(i, k, v) => setRow("efectivo", i, k, v)}
        onDel={(i) => delRow("efectivo", i)}
        totalLabel="Saldo del Día"
        total={fmt(calc.saldoDia)}
        addLabel="Agregar lugar"
      />

      {/* 4. Gastos */}
      <RowsCard
        n={4}
        title="Gastos"
        rows={f.gastos}
        onAdd={() => addRow("gastos")}
        onSet={(i, k, v) => setRow("gastos", i, k, v)}
        onDel={(i) => delRow("gastos", i)}
        totalLabel="Total de Gastos"
        total={fmt(calc.totalGastos)}
        addLabel="Agregar gasto"
      />

      {/* 5. Retiros */}
      <RowsCard
        n={5}
        title="Retiros (pagos virtuales)"
        hint="Mercado Pago, débito, crédito — plata que no es física."
        rows={f.retiros}
        onAdd={() => addRow("retiros")}
        onSet={(i, k, v) => setRow("retiros", i, k, v)}
        onDel={(i) => delRow("retiros", i)}
        totalLabel="Total Retiros"
        total={fmt(calc.totalRetiros)}
        addLabel="Agregar retiro"
      />

      {/* 6. Resumen */}
      <Card>
        <Title n={6}>Resumen y diferencia</Title>
        <SumLine k="Total de Gastos" v={fmt(calc.totalGastos)} />
        <SumLine k="Total Retiros" v={fmt(calc.totalRetiros)} />
        <SumLine k="Egresos totales" v={fmt(calc.egresos)} />
        <SumLine k="Saldo del Día (efectivo)" v={fmt(calc.saldoDia)} />

        <div className="mt-3 mb-1">
          <Label>Saldo del día anterior</Label>
          <div className="flex gap-2 items-stretch">
            <input type="text" inputMode="decimal" placeholder="0" className={AMOUNT} value={f.saldoAnterior} onChange={(e) => setField("saldoAnterior", e.target.value)} />
            {lastSaldo != null && (
              <button
                type="button"
                onClick={() => setField("saldoAnterior", String(Math.round(lastSaldo)))}
                className="whitespace-nowrap text-xs font-semibold text-purple-300 border border-gray-700 rounded-lg px-3 hover:bg-gray-800 transition-colors"
              >
                Usar ayer: {fmt(lastSaldo)}
              </button>
            )}
          </div>
        </div>

        <SumLine k="Suma total" v={fmt(calc.sumaTotal)} />
        <SumLine k="Total" v={fmt(calc.total)} strong />
        <SumLine k="Total ventas (esperado)" v={fmt(calc.esperado)} />
        <SumLine k="Diferencia" v={fmt(calc.diferencia)} strong />

        <div
          className={cn(
            "mt-3 p-3 rounded-lg text-center font-extrabold",
            diffOk ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
          )}
        >
          {diffOk ? "✓ La caja cuadra perfecto" : diff > 0 ? `↑ Sobra ${fmt(calc.diferencia)}` : `↓ Falta ${fmt(-calc.diferencia)}`}
        </div>
      </Card>

      {/* 7. Propinas */}
      <Card>
        <Title n={7}>Propinas</Title>
        <p className="text-xs text-gray-400 mb-3">Monto ÷ personas = cuánto le toca a cada uno.</p>
        <div className="space-y-2">
          {f.propinas.map((p, i) => {
            const cu = parseNum(p.personas) > 0 ? parseNum(p.monto) / parseNum(p.personas) : 0
            return (
              <div key={i} className="grid grid-cols-[1fr_100px_70px_auto] gap-2 items-center max-[520px]:grid-cols-[1fr_1fr_auto]">
                <input type="text" placeholder="Detalle (ej: TM)" className={INPUT} value={p.concepto} onChange={(e) => setProp(i, "concepto", e.target.value)} />
                <input type="text" inputMode="decimal" placeholder="0" className={AMOUNT} value={p.monto} onChange={(e) => setProp(i, "monto", e.target.value)} />
                <input type="text" inputMode="numeric" placeholder="pers." className={cn(INPUT, "text-right")} value={p.personas} onChange={(e) => setProp(i, "personas", e.target.value)} />
                <button type="button" onClick={() => delProp(i)} className="text-gray-500 hover:text-red-400 p-1.5" aria-label="Quitar propina">
                  <X className="w-4 h-4" />
                </button>
                <div className="col-span-full -mt-1 text-xs font-semibold text-green-400 text-right tabular-nums max-[520px]:text-left">
                  c/u: {fmt(cu)}
                </div>
              </div>
            )
          })}
        </div>
        <AddBtn onClick={addProp} label="Agregar propina" />
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed border-gray-700 font-bold text-gray-100">
          <span>Total Propinas</span>
          <span className="tabular-nums">{fmt(calc.totalPropinas)}</span>
        </div>
      </Card>

      {/* 8. Cierre */}
      <Card>
        <Title n={8}>Cierre de turno</Title>
        <label className="flex items-center gap-3 text-sm text-gray-100 font-medium cursor-pointer">
          <input type="checkbox" className="w-5 h-5 accent-green-500" checked={f.cierreHecho} onChange={(e) => setField("cierreHecho", e.target.checked)} />
          Cierre de turno hecho en el sistema (ticket Z)
        </label>
        <div className="mt-3">
          <Label>Notas</Label>
          <textarea className={cn(INPUT, "min-h-[60px] resize-y")} placeholder="Observaciones del día…" value={f.notas} onChange={(e) => setField("notas", e.target.value)} />
        </div>
      </Card>

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-3 print:hidden">
        <button type="button" onClick={saveCierre} className="col-span-2 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg py-3 text-sm transition-colors">
          <Save className="w-4 h-4" /> Guardar cierre
        </button>
        <button type="button" onClick={nuevo} className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-100 font-semibold rounded-lg py-3 text-sm transition-colors">
          <FilePlus2 className="w-4 h-4" /> Nuevo
        </button>
        <button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-100 font-semibold rounded-lg py-3 text-sm transition-colors">
          <Printer className="w-4 h-4" /> Imprimir / PDF
        </button>
        <button type="button" onClick={exportCSV} className="col-span-2 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-100 font-semibold rounded-lg py-3 text-sm transition-colors">
          <Download className="w-4 h-4" /> Exportar todo (CSV)
        </button>
      </div>

      {/* Historial */}
      <Card className="mt-4 print:hidden">
        <Title n={<History className="w-3 h-3" />}>Historial de cierres</Title>
        {sortedHist.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-3">Todavía no hay cierres guardados.</p>
        ) : (
          <div className="space-y-2">
            {sortedHist.map((s) => {
              const ok = Math.round(s.calc.diferencia) === 0
              const d = s.form.fecha ? s.form.fecha.split("-").reverse().join("/") : "(sin fecha)"
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 border border-gray-800 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-100 text-sm">
                      {d}
                      {s.form.numeroZ ? ` · Z ${s.form.numeroZ}` : ""}
                    </div>
                    <div className="text-xs text-gray-400 tabular-nums">
                      Total {fmt(s.calc.total)} · Esperado {fmt(s.calc.esperado)}
                    </div>
                  </div>
                  <span className={cn("text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap", ok ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                    {ok ? "Cuadra" : `${s.calc.diferencia > 0 ? "Sobra" : "Falta"} ${fmt(Math.abs(s.calc.diferencia))}`}
                  </span>
                  <button type="button" onClick={() => openCierre(s)} className="text-gray-500 hover:text-gray-200 p-1.5" aria-label="Abrir">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => delCierre(s.id)} className="text-gray-500 hover:text-red-400 p-1.5" aria-label="Borrar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Barra fija con el total + estado */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gray-950/95 backdrop-blur border-t border-gray-800 print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Total</div>
            <div className="text-lg font-extrabold tabular-nums text-white truncate">{fmt(calc.total)}</div>
          </div>
          <div className={cn("px-3 py-2 rounded-lg font-extrabold text-sm text-center min-w-[120px]", diffOk ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
            {diffOk ? "✓ Cuadra" : diff > 0 ? `Sobra ${fmt(calc.diferencia)}` : `Falta ${fmt(-calc.diferencia)}`}
          </div>
        </div>
      </div>

      {/* Mensajito de amor al cerrar la caja ❤️ */}
      {love && (
        <div
          onClick={() => setLove(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-label="Mensaje"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {["8%", "24%", "42%", "60%", "78%", "92%"].map((l, i) => (
              <span
                key={l}
                className="cierre-love-heart"
                style={{ left: l, animationDelay: `${i * 0.32}s`, fontSize: `${18 + (i % 3) * 12}px` }}
              >
                {["❤️", "💕", "💛", "💖", "💗", "💞"][i % 6]}
              </span>
            ))}
          </div>
          <div className="cierre-love-card relative w-full max-w-sm rounded-2xl border border-rose-400/30 bg-rose-950/90 px-6 py-8 text-center shadow-2xl">
            <div className="cierre-love-beat mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-rose-500/20">
              <Heart className="h-9 w-9 text-rose-400" fill="currentColor" />
            </div>
            <p className="text-lg font-extrabold leading-snug text-white">{love}</p>
            <p className="mt-3 text-xs font-medium text-rose-200/70">Cierre guardado ✓ · tocá para cerrar</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes cierrePop{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}
        @keyframes cierreBeat{0%,100%{transform:scale(1)}30%{transform:scale(1.18)}60%{transform:scale(.97)}}
        @keyframes cierreFloat{0%{transform:translateY(40px) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-260px) scale(1.1);opacity:0}}
        .cierre-love-card{animation:cierrePop .4s ease-out both}
        .cierre-love-beat{animation:cierreBeat 1s ease-in-out infinite}
        .cierre-love-heart{position:absolute;bottom:6%;animation:cierreFloat 2.8s ease-in infinite}
      `}</style>
    </div>
  )
}

// ── sub-componentes ──────────────────────────────────────────────────────────
function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 w-full flex items-center justify-center gap-1.5 border border-dashed border-gray-700 rounded-lg py-2.5 text-sm font-semibold text-purple-300 hover:bg-gray-800/60 hover:border-gray-600 transition-colors"
    >
      <Plus className="w-4 h-4" /> {label}
    </button>
  )
}

function RowsCard({
  n, title, hint, rows, onAdd, onSet, onDel, totalLabel, total, addLabel,
}: {
  n: ReactNode
  title: string
  hint?: string
  rows: Row[]
  onAdd: () => void
  onSet: (i: number, k: keyof Row, v: string) => void
  onDel: (i: number) => void
  totalLabel: string
  total: string
  addLabel: string
}) {
  return (
    <Card>
      <Title n={n}>{title}</Title>
      {hint && <p className="text-xs text-gray-400 mb-3">{hint}</p>}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_130px_auto] gap-2 items-center">
            <input type="text" placeholder="Concepto" className={INPUT} value={r.concepto} onChange={(e) => onSet(i, "concepto", e.target.value)} />
            <input type="text" inputMode="decimal" placeholder="0" className={AMOUNT} value={r.monto} onChange={(e) => onSet(i, "monto", e.target.value)} />
            <button type="button" onClick={() => onDel(i)} className="text-gray-500 hover:text-red-400 p-1.5" aria-label="Quitar">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <AddBtn onClick={onAdd} label={addLabel} />
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed border-gray-700 font-bold text-gray-100">
        <span>{totalLabel}</span>
        <span className="tabular-nums">{total}</span>
      </div>
    </Card>
  )
}
