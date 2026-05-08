/**
 * Cross-browser barcode scanner. Uses native BarcodeDetector when available
 * (Chrome, Edge, Samsung Internet on Android), falls back to ZXing for Safari/iOS
 * and any other browser without native support.
 */

const DEFAULT_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "qr_code",
  "itf",
] as const

export type BarcodeFormat = (typeof DEFAULT_FORMATS)[number]

export type StopFn = () => void

export interface StartOptions {
  formats?: BarcodeFormat[]
  /** Throttle duplicate detections within this window (ms). Default 1500. */
  dedupeMs?: number
}

interface NativeBarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): {
    detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
  }
}

/**
 * Starts the camera and begins detecting barcodes from the given <video> element.
 * Returns a stop function that releases the camera and cancels detection.
 *
 * Throws on camera permission errors so the caller can show a meaningful message.
 */
export async function startBarcodeScanner(
  video: HTMLVideoElement,
  onDetect: (code: string) => void,
  options: StartOptions = {},
): Promise<StopFn> {
  const formats: BarcodeFormat[] = options.formats ?? [...DEFAULT_FORMATS]
  const dedupeMs = options.dedupeMs ?? 1500

  let lastCode: string | null = null
  let lastAt = 0
  const dispatch = (code: string) => {
    if (!code) return
    const now = Date.now()
    if (code === lastCode && now - lastAt < dedupeMs) return
    lastCode = code
    lastAt = now
    onDetect(code)
  }

  const NativeBD = (typeof window !== "undefined"
    ? (window as unknown as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector
    : undefined)

  if (NativeBD) {
    return startNative(video, dispatch, formats, NativeBD)
  }
  return startZXing(video, dispatch, formats)
}

async function startNative(
  video: HTMLVideoElement,
  onDetect: (code: string) => void,
  formats: BarcodeFormat[],
  NativeBD: NativeBarcodeDetectorCtor,
): Promise<StopFn> {
  const detector = new NativeBD({ formats: [...formats] })
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false,
  })
  video.srcObject = stream
  video.setAttribute("playsinline", "true")
  await video.play().catch(() => {})

  let stopped = false
  const loop = async () => {
    if (stopped) return
    if (video.readyState >= 2) {
      try {
        const codes = await detector.detect(video)
        if (codes.length > 0 && codes[0].rawValue) {
          onDetect(codes[0].rawValue)
        }
      } catch {
        // ignore frame errors, keep scanning
      }
    }
    if (!stopped) requestAnimationFrame(loop)
  }
  loop()

  return () => {
    stopped = true
    stream.getTracks().forEach((t) => t.stop())
    if (video.srcObject) video.srcObject = null
  }
}

async function startZXing(
  video: HTMLVideoElement,
  onDetect: (code: string) => void,
  formats: BarcodeFormat[],
): Promise<StopFn> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat: ZXFormat, DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ])

  const formatMap: Record<BarcodeFormat, number> = {
    ean_13: ZXFormat.EAN_13,
    ean_8: ZXFormat.EAN_8,
    upc_a: ZXFormat.UPC_A,
    upc_e: ZXFormat.UPC_E,
    code_128: ZXFormat.CODE_128,
    code_39: ZXFormat.CODE_39,
    qr_code: ZXFormat.QR_CODE,
    itf: ZXFormat.ITF,
  }
  const zxingFormats = formats.map((f) => formatMap[f]).filter((v) => v !== undefined)
  const hints = new Map<number, unknown>()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, zxingFormats)
  hints.set(DecodeHintType.TRY_HARDER, true)

  const reader = new BrowserMultiFormatReader(hints)

  let deviceId: string | undefined
  try {
    const devices = await BrowserMultiFormatReader.listVideoInputDevices()
    const back = devices.find((d) => /back|rear|environment|trasera/i.test(d.label))
    deviceId = (back ?? devices[devices.length - 1])?.deviceId
  } catch {
    // ignore — let ZXing pick default
  }

  video.setAttribute("playsinline", "true")

  const controls = await reader.decodeFromVideoDevice(deviceId, video, (result) => {
    if (result) {
      const code = result.getText()
      if (code) onDetect(code)
    }
  })

  return () => {
    try {
      controls.stop()
    } catch {
      // ignore
    }
  }
}

export function isBarcodeScannerLikelySupported(): boolean {
  if (typeof window === "undefined") return false
  if (typeof navigator === "undefined") return false
  if (!navigator.mediaDevices?.getUserMedia) return false
  return true
}
