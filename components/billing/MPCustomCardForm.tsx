"use client"

/**
 * Form de tarjeta 100% custom: nosotros controlamos el HTML, layout y
 * estilos de TODOS los campos. MP solo se encarga de los 3 campos PCI-
 * sensibles (número, CVV, vencimiento) vía sus Secure Fields — son
 * iframes mini que renderizan dentro de divs nuestros.
 *
 * Flow:
 *   1. User completa: nombre, doc, email (HTML nuestro) + tarjeta, CVV,
 *      vencimiento (Secure Fields de MP).
 *   2. CardNumber dispara onBinChange → llamamos getPaymentMethods() para
 *      detectar marca (Visa/MC/Amex/Naranja/etc) y guardamos paymentMethodId.
 *   3. Submit → createCardToken({ cardholderName, doc }) → MP toma los
 *      valores de los Secure Fields automáticamente y devuelve un token.
 *   4. Pasamos token + paymentMethodId al endpoint /api/billing/mp/subscribe-with-card
 *      (sin cambios — el flow viejo ya funcionaba).
 */

import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from "react"
import dynamic from "next/dynamic"
import { Check, AlertCircle } from "lucide-react"

// SSR off — los Secure Fields tocan window.
const CardNumber = dynamic(
  () => import("@mercadopago/sdk-react").then((m) => m.CardNumber),
  { ssr: false, loading: () => null }
)
const ExpirationDate = dynamic(
  () => import("@mercadopago/sdk-react").then((m) => m.ExpirationDate),
  { ssr: false, loading: () => null }
)
const SecurityCode = dynamic(
  () => import("@mercadopago/sdk-react").then((m) => m.SecurityCode),
  { ssr: false, loading: () => null }
)

type IdType = "DNI" | "CUIL" | "CUIT" | "LE" | "LC"

export interface CardFormData {
  cardTokenId: string
  paymentMethodId: string
  payerEmail: string
}

export interface MPCustomCardFormHandle {
  submit: () => Promise<CardFormData | { error: string }>
}

interface Props {
  amount: number
  publicKey: string
  onTokenError?: (msg: string) => void
  /** Disparado una vez cuando el SDK terminó de cargar y el form puede recibir input. */
  onReady?: () => void
}

// Estilos compartidos para los iframes de Secure Fields. MP renderiza un
// <input> dentro del iframe usando estos estilos — tienen que matchear
// los inputs HTML nuestros para que se vea consistente.
const SECURE_FIELD_STYLE = {
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "500",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  placeholderColor: "#6b7280",
}

export const MPCustomCardForm = forwardRef<MPCustomCardFormHandle, Props>(function MPCustomCardForm(
  { amount, publicKey, onTokenError, onReady },
  ref
) {
  // Campos no sensibles (controlados por nosotros)
  const [cardholderName, setCardholderName] = useState("")
  const [docType, setDocType] = useState<IdType>("DNI")
  const [docNumber, setDocNumber] = useState("")
  const [payerEmail, setPayerEmail] = useState("")

  // Estado de los Secure Fields (validez)
  const [cardNumberValid, setCardNumberValid] = useState(false)
  const [expirationValid, setExpirationValid] = useState(false)
  const [securityCodeValid, setSecurityCodeValid] = useState(false)

  // Estado SDK
  const [sdkReady, setSdkReady] = useState(false)

  // Detección de marca
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null)
  const [paymentMethodName, setPaymentMethodName] = useState<string | null>(null)
  const [paymentMethodThumbnail, setPaymentMethodThumbnail] = useState<string | null>(null)
  const [binError, setBinError] = useState<string | null>(null)

  // Refs para callbacks — evita re-correr el useEffect de init cuando el
  // padre re-renderiza con funciones nuevas en cada render.
  const onTokenErrorRef = useRef(onTokenError)
  const onReadyRef = useRef(onReady)
  useEffect(() => { onTokenErrorRef.current = onTokenError })
  useEffect(() => { onReadyRef.current = onReady })

  // Init SDK — se hace una sola vez al mount
  useEffect(() => {
    let cancelled = false
    import("@mercadopago/sdk-react")
      .then(async (m) => {
        if (cancelled) return
        try {
          m.initMercadoPago(publicKey, { locale: "es-AR" })
        } catch { /* idempotente */ }
        setSdkReady(true)
        onReadyRef.current?.()
      })
      .catch((e) => {
        console.error("[MP custom] init failed", e)
        onTokenErrorRef.current?.("No se pudo inicializar Mercado Pago.")
      })
    return () => { cancelled = true }
  }, [publicKey])

  // Detectar marca cuando cambia el BIN (primeros 6 dígitos del card number)
  const handleBinChange = async (arg: { bin?: string }) => {
    const bin = arg.bin
    setBinError(null)
    if (!bin || bin.length < 6) {
      setPaymentMethodId(null)
      setPaymentMethodName(null)
      setPaymentMethodThumbnail(null)
      return
    }
    try {
      const m = await import("@mercadopago/sdk-react")
      const res: any = await m.getPaymentMethods({ bin })
      const result = res?.results?.[0]
      if (result) {
        setPaymentMethodId(result.id)
        setPaymentMethodName(result.name)
        setPaymentMethodThumbnail(result.thumbnail ?? result.secure_thumbnail ?? null)
      } else {
        setPaymentMethodId(null)
        setPaymentMethodName(null)
        setPaymentMethodThumbnail(null)
        setBinError("No reconocemos esta tarjeta. Probá con otra.")
      }
    } catch (e) {
      console.warn("[MP custom] getPaymentMethods failed", e)
      setBinError("No pudimos validar la tarjeta. Verificá tu conexión.")
    }
  }

  // Validez total del form — el botón se habilita cuando todo está OK
  const formValid =
    cardNumberValid &&
    expirationValid &&
    securityCodeValid &&
    cardholderName.trim().length >= 2 &&
    docNumber.trim().length >= 7 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail.trim()) &&
    !!paymentMethodId

  // Submit programático — lo dispara el botón del modal padre
  useImperativeHandle(ref, () => ({
    submit: async (): Promise<CardFormData | { error: string }> => {
      if (!sdkReady) return { error: "Mercado Pago todavía está cargando." }
      if (!paymentMethodId) return { error: "No pudimos identificar la tarjeta. Revisá el número." }
      if (!formValid) return { error: "Faltan datos o son incorrectos. Revisá los campos." }

      try {
        const m = await import("@mercadopago/sdk-react")
        // El método de createCardToken para Secure Fields toma SOLO los
        // datos no sensibles — el SDK lee los valores de los iframes
        // internamente, así nosotros nunca tocamos número/cvv/exp.
        const token: any = await m.createCardToken({
          cardholderName: cardholderName.trim(),
          identificationType: docType,
          identificationNumber: docNumber.trim().replace(/\D/g, ""),
        })
        if (!token?.id) {
          return { error: "Mercado Pago no pudo generar el token. Revisá los datos de la tarjeta." }
        }
        return {
          cardTokenId: token.id,
          paymentMethodId,
          payerEmail: payerEmail.trim().toLowerCase(),
        }
      } catch (err: any) {
        console.error("[MP custom] createCardToken failed", err)
        const msg = err?.message ?? err?.cause?.[0]?.description ?? "No se pudo procesar la tarjeta."
        return { error: msg }
      }
    },
  }), [sdkReady, paymentMethodId, formValid, cardholderName, docType, docNumber, payerEmail])

  return (
    <div className="space-y-4">
      {/* Número de tarjeta */}
      <FieldWrapper label="Número de tarjeta">
        <div className="relative bg-[#0d0f15] border border-gray-800 hover:border-gray-700 focus-within:border-purple-500 rounded-xl px-4 py-[15px] transition-colors h-[52px]">
          {sdkReady ? (
            <CardNumber
              placeholder="1234 1234 1234 1234"
              style={SECURE_FIELD_STYLE}
              onBinChange={handleBinChange}
              onValidityChange={(arg) => setCardNumberValid(arg.errorMessages.length === 0)}
            />
          ) : (
            <SkeletonInput />
          )}
          {paymentMethodThumbnail && (
            <img
              src={paymentMethodThumbnail}
              alt={paymentMethodName ?? ""}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-6 max-w-[40px] object-contain"
            />
          )}
        </div>
        {paymentMethodName && (
          <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1">
            <Check size={11} /> Detectamos {paymentMethodName}
          </p>
        )}
        {binError && (
          <p className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1">
            <AlertCircle size={11} /> {binError}
          </p>
        )}
      </FieldWrapper>

      {/* Vencimiento + CVV en grid */}
      <div className="grid grid-cols-2 gap-3">
        <FieldWrapper label="Vencimiento">
          <div className="bg-[#0d0f15] border border-gray-800 hover:border-gray-700 focus-within:border-purple-500 rounded-xl px-4 py-[15px] transition-colors h-[52px]">
            {sdkReady ? (
              <ExpirationDate
                placeholder="MM/AA"
                mode="short"
                style={SECURE_FIELD_STYLE}
                onValidityChange={(arg) => setExpirationValid(arg.errorMessages.length === 0)}
              />
            ) : (
              <SkeletonInput />
            )}
          </div>
        </FieldWrapper>

        <FieldWrapper label="Código de seguridad">
          <div className="bg-[#0d0f15] border border-gray-800 hover:border-gray-700 focus-within:border-purple-500 rounded-xl px-4 py-[15px] transition-colors h-[52px]">
            {sdkReady ? (
              <SecurityCode
                placeholder="CVV"
                style={SECURE_FIELD_STYLE}
                onValidityChange={(arg) => setSecurityCodeValid(arg.errorMessages.length === 0)}
              />
            ) : (
              <SkeletonInput />
            )}
          </div>
        </FieldWrapper>
      </div>

      {/* Nombre del titular */}
      <FieldWrapper label="Nombre del titular">
        <input
          type="text"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
          placeholder="MARÍA LÓPEZ"
          autoComplete="cc-name"
          className="w-full bg-[#0d0f15] border border-gray-800 hover:border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 rounded-xl px-4 h-[52px] text-white placeholder-gray-500 text-[15px] font-medium transition-colors"
        />
      </FieldWrapper>

      {/* Doc + email */}
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <FieldWrapper label="Documento">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as IdType)}
            className="w-full bg-[#0d0f15] border border-gray-800 hover:border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 rounded-xl px-3 h-[52px] text-white text-[15px] font-medium appearance-none cursor-pointer transition-colors"
          >
            <option value="DNI">DNI</option>
            <option value="CUIL">CUIL</option>
            <option value="CUIT">CUIT</option>
            <option value="LE">LE</option>
            <option value="LC">LC</option>
          </select>
        </FieldWrapper>
        <FieldWrapper label="Número">
          <input
            type="text"
            inputMode="numeric"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
            placeholder="12345678"
            className="w-full bg-[#0d0f15] border border-gray-800 hover:border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 rounded-xl px-4 py-[14px] text-white placeholder-gray-500 text-[15px] font-medium transition-colors tabular-nums"
          />
        </FieldWrapper>
      </div>

      {/* Email */}
      <FieldWrapper label="Email">
        <input
          type="email"
          value={payerEmail}
          onChange={(e) => setPayerEmail(e.target.value)}
          placeholder="tu@email.com"
          autoComplete="email"
          className="w-full bg-[#0d0f15] border border-gray-800 hover:border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 rounded-xl px-4 h-[52px] text-white placeholder-gray-500 text-[15px] font-medium transition-colors"
        />
      </FieldWrapper>
    </div>
  )
})

function FieldWrapper({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.1em] text-gray-400 font-bold mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

function SkeletonInput() {
  return (
    <div className="h-5 bg-gray-800/40 rounded animate-pulse" />
  )
}
