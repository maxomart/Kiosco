"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Download,
  Smartphone,
  Apple,
  Monitor,
  ShieldCheck,
  Sparkles,
  Wifi,
  WifiOff,
  Check,
  ArrowDown,
  Share,
  Laptop,
  ExternalLink,
} from "lucide-react"

/**
 * Estado del último release de Orvex Desktop publicado en GitHub.
 * Lo consultamos via /api/desktop/release que cachea la respuesta de
 * GitHub 5min y maneja el caso "todavía no hay release publicado"
 * (al inicio del proyecto) sin tirar 404 al user.
 */
interface ReleaseInfo {
  available: boolean
  version?: string
  publishedAt?: string
  htmlUrl?: string
  assets?: {
    macArm64?: string
    macIntel?: string
    winInstaller?: string
    winPortable?: string
    linuxAppImage?: string
    linuxDeb?: string
  }
}

interface DesktopDownload {
  label: string
  hint: string
  href: string
  size: string
}

/**
 * Resuelve el download recomendado según OS detectado y los assets
 * del release actual. Si el OS no tiene asset todavía, devuelve null
 * (el page muestra "próximamente" para esa plataforma).
 */
function pickDownload(device: Device, release: ReleaseInfo | null): DesktopDownload | null {
  if (!release?.available || !release.assets) return null
  const a = release.assets

  switch (device) {
    case "macos": {
      // Detección Apple Silicon: por default asumimos ARM (más común
      // en Macs de los últimos 4 años). Si el user tiene Intel y
      // sabemos detectarlo via userAgentData, tomamos esa info.
      const uad = typeof navigator !== "undefined" ? (navigator as any).userAgentData : null
      const isIntel = uad?.architecture === "x86"
      if (isIntel && a.macIntel) {
        return { label: "Descargar para Mac (Intel)", hint: "Macs anteriores a 2020", href: a.macIntel, size: "~95 MB" }
      }
      if (a.macArm64) {
        return { label: "Descargar para Mac (Apple Silicon)", hint: "M1 · M2 · M3 · M4 — recomendado", href: a.macArm64, size: "~95 MB" }
      }
      if (a.macIntel) {
        return { label: "Descargar para Mac (Intel)", hint: "Macs anteriores a 2020", href: a.macIntel, size: "~95 MB" }
      }
      return null
    }
    case "windows":
      if (a.winInstaller) return { label: "Descargar para Windows", hint: "Windows 10 y 11 · 64 bits", href: a.winInstaller, size: "~85 MB" }
      if (a.winPortable) return { label: "Descargar para Windows (portable)", hint: "Sin instalador", href: a.winPortable, size: "~85 MB" }
      return null
    case "linux":
      if (a.linuxAppImage) return { label: "Descargar para Linux", hint: "AppImage · cualquier distro", href: a.linuxAppImage, size: "~90 MB" }
      if (a.linuxDeb) return { label: "Descargar para Linux (Debian/Ubuntu)", hint: ".deb", href: a.linuxDeb, size: "~90 MB" }
      return null
    default:
      return null
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type Device = "android" | "ios" | "macos" | "windows" | "linux" | "other"

function detectDevice(): Device {
  if (typeof navigator === "undefined") return "other"
  const ua = navigator.userAgent.toLowerCase()
  if (/android/.test(ua)) return "android"
  if (/iphone|ipad|ipod/.test(ua)) return "ios"
  if (/macintosh|mac os x/.test(ua)) return "macos"
  if (/windows/.test(ua)) return "windows"
  if (/linux/.test(ua)) return "linux"
  return "other"
}

export default function DescargarPage() {
  const [device, setDevice] = useState<Device>("other")
  const [origin, setOrigin] = useState("")
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [browser, setBrowser] = useState<"chrome" | "safari" | "firefox" | "edge" | "samsung" | "other">("other")

  useEffect(() => {
    setOrigin(window.location.origin)
    setDevice(detectDevice())

    // Detectar browser para instrucciones puntuales
    const ua = navigator.userAgent.toLowerCase()
    if (/edg\//.test(ua)) setBrowser("edge")
    else if (/samsungbrowser/.test(ua)) setBrowser("samsung")
    else if (/chrome\//.test(ua) && !/edg\//.test(ua)) setBrowser("chrome")
    else if (/firefox/.test(ua)) setBrowser("firefox")
    else if (/safari/.test(ua) && !/chrome/.test(ua)) setBrowser("safari")

    // Detectar si ya está instalada (running en standalone)
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    if (isStandalone) setInstalled(true)

    // Capturar evento de instalación
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)

    // Detectar si se instala
    const onInstalled = () => setInstalled(true)
    window.addEventListener("appinstalled", onInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const install = async () => {
    if (!installEvent) return
    setInstalling(true)
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === "accepted") setInstalled(true)
    setInstalling(false)
  }

  const canInstallNative = !!installEvent && !installed
  const isDesktopDevice = device === "macos" || device === "windows" || device === "linux"

  // Estado del release de la app desktop. null mientras carga la
  // primera vez. Si la query falla, queda null y mostramos UI neutra.
  const [release, setRelease] = useState<ReleaseInfo | null>(null)
  const [releaseLoading, setReleaseLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/desktop/release", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ReleaseInfo | null) => {
        if (!cancelled) setRelease(data)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setReleaseLoading(false) })
    return () => { cancelled = true }
  }, [])

  const desktopDownload = pickDownload(device, release)

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-950 to-black text-white">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-white font-bold text-lg">
            <span className="bg-gradient-to-br from-blue-400 to-violet-400 bg-clip-text text-transparent">Orvex</span>
          </Link>
          <Link href="/login" className="text-sm text-gray-400 hover:text-white">
            Iniciá sesión →
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium mb-6">
            <Sparkles size={12} />
            Funciona en tu celu, tu compu y la tablet
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-4">
            Instalá Orvex en tu dispositivo
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto">
            Sin Play Store, sin App Store. Una sola web, en cualquier pantalla.
          </p>
        </div>

        {/* Estado: ya instalada */}
        {installed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-6 text-center mb-8"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-emerald-100 mb-1">¡Ya está instalada!</h2>
            <p className="text-sm text-emerald-200/80 mb-4">
              Estás corriendo Orvex en modo app. Buscá el ícono en tu pantalla principal.
            </p>
            <Link
              href="/inicio"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm"
            >
              Ir al dashboard
            </Link>
          </motion.div>
        )}

        {/* App de escritorio — tres estados:
              1. Loading: el endpoint /api/desktop/release todavía está
                 contestando. Mostramos skeleton para no flash.
              2. release.available + desktopDownload: hay binarios y el
                 OS del user tiene asset → botón con link directo.
              3. release.available pero no hay asset para este OS, o
                 release.available === false: mostramos "próximamente"
                 con CTA a la PWA. */}
        {!installed && isDesktopDevice && (
          <div className="max-w-2xl mx-auto bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 rounded-3xl p-6 sm:p-8 mb-10 relative overflow-hidden shadow-2xl shadow-purple-900/40">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-fuchsia-300/15 blur-3xl rounded-full pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                  <Laptop className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-white/70">App de escritorio</p>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Orvex como app real
                  </h2>
                </div>
              </div>
              <p className="text-sm text-purple-100 leading-relaxed mb-5 max-w-md">
                Sin barra de Chrome. Ícono propio en el dock. Funciona offline. Se actualiza sola. Es lo más cerca de una app nativa que tenemos.
              </p>

              {releaseLoading && (
                <div className="h-12 w-72 bg-white/15 rounded-xl animate-pulse" />
              )}

              {!releaseLoading && desktopDownload && (
                <>
                  <a
                    href={desktopDownload.href}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-purple-700 font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg"
                  >
                    <Download size={16} />
                    {desktopDownload.label}
                    <span className="text-xs font-normal text-purple-500/80 ml-1">· {desktopDownload.size}</span>
                  </a>
                  <p className="text-xs text-purple-200/80 mt-3">
                    {desktopDownload.hint}
                    {release?.version && <span className="ml-2 text-white/60">· v{release.version}</span>}
                  </p>
                </>
              )}

              {!releaseLoading && !desktopDownload && (
                <div className="bg-white/10 border border-white/20 rounded-xl p-4">
                  <p className="text-sm font-semibold text-white mb-1">
                    Próximamente para descargar
                  </p>
                  <p className="text-xs text-purple-100/90 leading-relaxed mb-3">
                    Estamos terminando los builds firmados para macOS, Windows y Linux. Mientras tanto podés instalar Orvex como PWA — el comportamiento es prácticamente igual.
                  </p>
                  <a
                    href="#pwa"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-purple-700 font-semibold text-xs hover:scale-[1.02] transition-transform"
                  >
                    Instalar como PWA
                    <ArrowDown size={12} />
                  </a>
                </div>
              )}

              {/* Links a otros OS — solo si tenemos release con assets */}
              {!releaseLoading && release?.available && release.assets && (
                <div className="mt-4 pt-4 border-t border-white/15 flex flex-wrap gap-3 text-xs">
                  <span className="text-purple-200/70">¿Otro sistema?</span>
                  {device !== "macos" && release.assets.macArm64 && (
                    <a href={release.assets.macArm64} className="text-white hover:underline">Mac (Apple Silicon)</a>
                  )}
                  {device !== "windows" && release.assets.winInstaller && (
                    <a href={release.assets.winInstaller} className="text-white hover:underline">Windows</a>
                  )}
                  {device !== "linux" && release.assets.linuxAppImage && (
                    <a href={release.assets.linuxAppImage} className="text-white hover:underline">Linux</a>
                  )}
                  {release.htmlUrl && (
                    <a
                      href={release.htmlUrl}
                      target="_blank" rel="noopener noreferrer"
                      className="text-purple-200 hover:underline inline-flex items-center gap-1"
                    >
                      Todas las versiones <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botón nativo PWA (Chrome / Edge / Samsung Browser) — alternativa
            cuando no hay binario, o para mobile. */}
        {canInstallNative && (
          <div className="max-w-md mx-auto bg-gradient-to-br from-blue-600 to-cyan-600 rounded-3xl p-6 sm:p-8 text-center mb-10 relative overflow-hidden shadow-2xl shadow-blue-900/40">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 blur-3xl rounded-full" />
            <Download className="w-10 h-10 text-white mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-white mb-2">
              {isDesktopDevice ? "¿Preferís sin instalar?" : "Tu navegador soporta instalación nativa"}
            </h2>
            <p className="text-sm text-blue-100 mb-5">
              {isDesktopDevice
                ? "Instalala como PWA desde tu navegador — más liviano, sin instalador."
                : "Tocá el botón y listo. Te queda con ícono propio, sin barra de Chrome."}
            </p>
            <button
              onClick={install}
              disabled={installing}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-blue-700 font-bold text-base hover:scale-[1.02] active:scale-[0.99] transition-all shadow-lg disabled:opacity-50"
            >
              {installing ? "Instalando…" : "Instalar como PWA"}
            </button>
          </div>
        )}

        {/* Instrucciones por dispositivo */}
        {!installed && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card Android */}
            <DeviceCard
              icon={<Smartphone className="w-8 h-8 text-emerald-400" />}
              title="Android"
              active={device === "android"}
            >
              {browser === "chrome" || browser === "edge" || browser === "samsung" ? (
                <>
                  <Step n={1}>
                    Tocá el botón de arriba <strong className="text-white">"Instalar Orvex"</strong>
                  </Step>
                  <Step n={2}>
                    Si no te apareció, abrí el menú del navegador (los <strong>tres puntos</strong>) y elegí{" "}
                    <strong className="text-white">"Instalar app"</strong> o <strong className="text-white">"Agregar a pantalla de inicio"</strong>
                  </Step>
                  <Step n={3}>El ícono de Orvex aparece en tu pantalla principal</Step>
                </>
              ) : (
                <>
                  <Step n={1}>
                    Abrí esta página en <strong className="text-white">Chrome</strong> o <strong className="text-white">Samsung Internet</strong>
                  </Step>
                  <Step n={2}>
                    Menú de tres puntos → <strong className="text-white">"Instalar app"</strong>
                  </Step>
                </>
              )}
            </DeviceCard>

            {/* Card iPhone */}
            <DeviceCard
              icon={<Apple className="w-8 h-8 text-gray-300" />}
              title="iPhone / iPad"
              active={device === "ios"}
            >
              {browser !== "safari" && device === "ios" && (
                <p className="text-amber-300 text-xs bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5 mb-2">
                  ⚠️ En iPhone <strong>tenés que usar Safari</strong> (no Chrome) para instalar.
                </p>
              )}
              <Step n={1}>
                Abrí esta página en <strong className="text-white">Safari</strong>
              </Step>
              <Step n={2}>
                Tocá el botón <span className="inline-flex items-center gap-1"><Share size={12} /> compartir</span> abajo
              </Step>
              <Step n={3}>
                Bajá hasta <strong className="text-white">"Agregar a pantalla de inicio"</strong>
              </Step>
              <Step n={4}>Listo — Orvex queda como app nativa</Step>
            </DeviceCard>

            {/* Card Mac */}
            <DeviceCard
              icon={<Monitor className="w-8 h-8 text-sky-400" />}
              title="Mac / Windows / Linux"
              active={device === "macos" || device === "windows" || device === "linux"}
            >
              <Step n={1}>
                Abrí esta página en <strong className="text-white">Chrome</strong> o <strong className="text-white">Edge</strong>
              </Step>
              <Step n={2}>
                En la barra de direcciones, mirá del lado derecho — vas a ver un{" "}
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <Download size={12} /> ícono de descarga
                </span>
                . Hacele click.
              </Step>
              <Step n={3}>
                Confirmá <strong className="text-white">"Instalar"</strong>. Aparece en tu carpeta de Aplicaciones.
              </Step>
              {device === "macos" && (
                <p className="text-[11px] text-gray-500 mt-2">
                  Tip: en Safari para Mac, el menú es <strong>Archivo → "Agregar al Dock"</strong>.
                </p>
              )}
            </DeviceCard>

            {/* Card iPad / tablet */}
            <DeviceCard
              icon={<Smartphone className="w-8 h-8 text-purple-400" />}
              title="Tablets Android"
              active={false}
            >
              <p className="text-sm text-gray-400 mb-2">
                Mismas instrucciones que en Android. Funciona genial en pantallas grandes (POS estilo caja).
              </p>
              <p className="text-[11px] text-gray-500">
                Tip: si pones la tablet en horizontal, el POS queda con el carrito al costado y los productos en grilla — perfecto para el mostrador.
              </p>
            </DeviceCard>
          </div>
        )}

        {/* Beneficios */}
        <section className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card icon={<WifiOff className="w-5 h-5 text-emerald-400" />} title="Funciona offline">
            Vendé sin internet en el POS. Las ventas se sincronizan al volver la conexión.
          </Card>
          <Card icon={<Wifi className="w-5 h-5 text-sky-400" />} title="Se actualiza sola">
            Cada vez que pusheamos mejoras, tu app las recibe sin que reinstales nada.
          </Card>
          <Card icon={<ShieldCheck className="w-5 h-5 text-purple-400" />} title="Sin pasos turbios">
            Es una web instalada — no es un APK ni nada que tengas que aprobar a mano.
          </Card>
        </section>

        <footer className="mt-16 text-center text-xs text-gray-600">
          © {new Date().getFullYear()} Orvex · <Link href="/" className="hover:text-gray-400">Volver al inicio</Link>
        </footer>
      </div>
    </main>
  )
}

function DeviceCard({
  icon,
  title,
  active,
  children,
}: {
  icon: React.ReactNode
  title: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-3xl p-6 sm:p-7 border transition-all ${
        active
          ? "bg-gradient-to-br from-emerald-500/10 via-gray-900 to-gray-900 border-emerald-700/40 ring-1 ring-emerald-500/20"
          : "bg-gray-900/40 border-gray-800"
      }`}
    >
      {active && (
        <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-300 font-bold mb-2">
          Tu dispositivo
        </div>
      )}
      <div className="mb-3">{icon}</div>
      <h2 className="text-xl font-bold text-white mb-3">{title}</h2>
      <ol className="space-y-2.5">{children}</ol>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-800 border border-gray-700 text-gray-300 text-[10px] font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span className="text-gray-300 leading-relaxed">{children}</span>
    </li>
  )
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
      <div className="mb-2">{icon}</div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-xs text-gray-400 leading-relaxed">{children}</p>
    </div>
  )
}
