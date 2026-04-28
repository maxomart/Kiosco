"use client"

/**
 * Form de tarjeta 100% custom usando el SDK MP imperativamente (no los
 * componentes React). Los componentes React tenían un bug donde los
 * iframes de los Secure Fields se posicionaban en el wrapper equivocado
 * porque cada chunk dinámico cargaba en orden distinto.
 *
 * Solución: divs con IDs fijos (#mp-card-number, #mp-expiration-date,
 * #mp-security-code) y `mp.fields.create().mount("#id")` desde un
 * useEffect — así el SDK sabe exactamente dónde poner cada iframe.
 *
 * Flow:
 *   1. SDK carga → creamos instancia mp + montamos los 3 Secure Fields
 *      en sus contenedores específicos.
 *   2. CardNumber dispara binChange → getPaymentMethods() → marca detectada.
 *   3. Submit → mp.fields.createCardToken({ cardholderName, doc }) →
 *      el SDK toma número/cvv/exp de los iframes y devuelve un token.
 *   4. POST al backend (sin cambios).
 */

import { useEffect, useState, useRef, useImperativeHandle, forwardRef, useCallback } from "react"
import { Check, AlertCircle } from "lucide-react"

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
  onReady?: () => void
}

// Estilos para los iframes de Secure Fields. MP renderiza un <input> dentro
// del iframe usando estos estilos — tienen que matchear los inputs HTML
// nuestros para que se vea consistente.
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

  // Validez de los Secure Fields
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

  // Refs internas para callbacks volátiles del padre
  const onTokenErrorRef = useRef(onTokenError)
  const onReadyRef = useRef(onReady)
  useEffect(() => { onTokenErrorRef.current = onTokenError })
  useEffect(() => { onReadyRef.current = onReady })

  // Instancia MP guardada para usar en submit
  const mpInstanceRef = useRef<any>(null)

  // Name estable del input trampa anti-autofill
  const [trapName] = useState(() => `fake-cc-${Math.random().toString(36).slice(2, 8)}`)

  // Cargar SDK + montar los 3 Secure Fields imperativamente
  useEffect(() => {
    let cancelled = false
    const mountedFields: any[] = []

    // Cargar el script global de MP v2 (no el SDK React) — sólo el v2
    // expone window.MercadoPago para la API imperativa.
    const loadMpScript = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if ((window as any).MercadoPago) return resolve()
        const existing = document.getElementById("mp-sdk-v2") as HTMLScriptElement | null
        if (existing) {
          if ((window as any).MercadoPago) return resolve()
          existing.addEventListener("load", () => resolve(), { once: true })
          existing.addEventListener("error", () => reject(new Error("MP script failed")), { once: true })
          return
        }
        const script = document.createElement("script")
        script.id = "mp-sdk-v2"
        script.src = "https://sdk.mercadopago.com/js/v2"
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error("MP script failed to load"))
        document.head.appendChild(script)
      })
    }

    ;(async () => {
      try {
        await loadMpScript()
        if (cancelled) return

        const MP = (window as any).MercadoPago
        if (!MP) throw new Error("Window.MercadoPago no disponible")

        const mp = new MP(publicKey, { locale: "es-AR" })
        mpInstanceRef.current = mp

        // Crear y montar los 3 fields en orden, cada uno en su contenedor
        const cardNumberField = mp.fields.create("cardNumber", {
          placeholder: "1234 1234 1234 1234",
          style: SECURE_FIELD_STYLE,
        })
        cardNumberField.mount("mp-card-number")
        mountedFields.push(cardNumberField)

        cardNumberField.on("binChange", async (arg: { bin?: string }) => {
          const bin = arg.bin
          setBinError(null)
          if (!bin || bin.length < 6) {
            setPaymentMethodId(null)
            setPaymentMethodName(null)
            setPaymentMethodThumbnail(null)
            return
          }
          try {
            // mp.getPaymentMethods existe en la instancia del SDK v2
            const res: any = await mp.getPaymentMethods({ bin })
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
          } catch {
            setBinError("No pudimos validar la tarjeta. Verificá tu conexión.")
          }
        })
        cardNumberField.on("validityChange", (arg: { errorMessages: any[] }) => {
          setCardNumberValid(arg.errorMessages.length === 0)
        })

        const expirationField = mp.fields.create("expirationDate", {
          placeholder: "MM/AA",
          style: SECURE_FIELD_STYLE,
        })
        expirationField.mount("mp-expiration-date")
        mountedFields.push(expirationField)
        expirationField.on("validityChange", (arg: { errorMessages: any[] }) => {
          setExpirationValid(arg.errorMessages.length === 0)
        })

        const securityField = mp.fields.create("securityCode", {
          placeholder: "CVV",
          style: SECURE_FIELD_STYLE,
        })
        securityField.mount("mp-security-code")
        mountedFields.push(securityField)
        securityField.on("validityChange", (arg: { errorMessages: any[] }) => {
          setSecurityCodeValid(arg.errorMessages.length === 0)
        })

        if (cancelled) {
          mountedFields.forEach((f) => { try { f.unmount() } catch {} })
          return
        }

        setSdkReady(true)
        onReadyRef.current?.()
      } catch (e: any) {
        console.error("[MP custom] init/mount failed", e)
        onTokenErrorRef.current?.("No se pudo inicializar Mercado Pago.")
      }
    })()

    return () => {
      cancelled = true
      // Cleanup: unmount cada field para liberar los iframes
      mountedFields.forEach((f) => { try { f.unmount() } catch {} })
      mpInstanceRef.current = null
    }
  }, [publicKey])

  // Validez total — el botón se habilita cuando todo está OK
  const formValid =
    cardNumberValid &&
    expirationValid &&
    securityCodeValid &&
    cardholderName.trim().length >= 2 &&
    docNumber.trim().length >= 7 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail.trim()) &&
    !!paymentMethodId

  // Submit programático que llama el botón del modal padre
  useImperativeHandle(ref, () => ({
    submit: async (): Promise<CardFormData | { error: string }> => {
      if (!sdkReady) return { error: "Mercado Pago todavía está cargando." }
      if (!paymentMethodId) return { error: "No pudimos identificar la tarjeta. Revisá el número." }
      if (!formValid) return { error: "Faltan datos o son incorrectos. Revisá los campos." }
      const mp = mpInstanceRef.current
      if (!mp) return { error: "El formulario perdió la conexión con MP. Refrescá la página." }

      try {
        // Con Secure Fields, createCardToken solo recibe los datos NO sensibles
        // — el SDK lee internamente número/cvv/exp de los iframes.
        const token: any = await mp.fields.createCardToken({
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

  // onSubmit estable
  const onFormSubmit = useCallback((e: React.FormEvent) => e.preventDefault(), [])

  return (
    <form
      autoComplete="off"
      role="presentation"
      onSubmit={onFormSubmit}
      className="space-y-4"
    >
      {/* Trampa anti-autofill */}
      <input
        type="text"
        name={trapName}
        autoComplete="cc-number"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute opacity-0 pointer-events-none w-0 h-0"
      />

      {/* Número de tarjeta — el SDK MP monta su iframe DENTRO de este div */}
      <FieldWrapper label="Número de tarjeta">
        <div className="relative bg-[#0d0f15] border border-gray-800 hover:border-gray-700 focus-within:border-purple-500 rounded-xl px-4 py-[15px] transition-colors h-[52px]">
          <div id="mp-card-number" className="h-full" />
          {!sdkReady && <SkeletonInput />}
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
            <div id="mp-expiration-date" className="h-full" />
            {!sdkReady && <SkeletonInput />}
          </div>
        </FieldWrapper>

        <FieldWrapper label="Código de seguridad">
          <div className="bg-[#0d0f15] border border-gray-800 hover:border-gray-700 focus-within:border-purple-500 rounded-xl px-4 py-[15px] transition-colors h-[52px]">
            <div id="mp-security-code" className="h-full" />
            {!sdkReady && <SkeletonInput />}
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
          autoComplete="off"
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
            className="w-full bg-[#0d0f15] border border-gray-800 hover:border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 rounded-xl px-4 h-[52px] text-white placeholder-gray-500 text-[15px] font-medium transition-colors tabular-nums"
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
    </form>
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
    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-5 bg-gray-800/40 rounded animate-pulse" />
  )
}
