/**
 * Capa de transporte para impresoras térmicas. Maneja tanto Bluetooth
 * (Web Bluetooth API) como USB (WebUSB API). La capa de comandos
 * (ESC/POS) vive en lib/escpos.ts — esto sólo se ocupa de llevar los
 * bytes al hardware.
 *
 * Bluetooth es lo más común en kioscos argentinos hoy (Xprinter XP-58HC
 * BT, MUNBYN, Goojprt, etc.). USB también soportado para impresoras
 * conectadas a la PC.
 *
 * Soporte:
 *   - Bluetooth: Chrome / Edge en desktop, Chrome en Android. NO iOS.
 *   - USB: Chrome / Edge en desktop. NO mobile.
 *
 * Caveat iOS: ni Web Bluetooth ni WebUSB funcionan en iPhone/iPad. La
 * clienta que use iOS tiene que caer al print dialog clásico.
 */

// ============================================================================
// Type declarations — Web Bluetooth y WebUSB no están en los DOM types
// por default así que los declaramos mínimos para que TS no se queje.
// ============================================================================
interface BluetoothDevice {
  id: string
  name?: string
  gatt?: BluetoothRemoteGATTServer
}
interface BluetoothRemoteGATTServer {
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>
}
interface BluetoothRemoteGATTService {
  uuid: string
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>
}
interface BluetoothRemoteGATTCharacteristic {
  uuid: string
  properties: {
    write: boolean
    writeWithoutResponse: boolean
  }
  writeValue(value: BufferSource): Promise<void>
  writeValueWithoutResponse?(value: BufferSource): Promise<void>
}
interface USBDevice {
  productName?: string
  manufacturerName?: string
  configuration?: { interfaces: USBInterface[] }
  opened: boolean
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(n: number): Promise<void>
  claimInterface(n: number): Promise<void>
  transferOut(endpointNumber: number, data: BufferSource): Promise<{ status: string }>
}
interface USBInterface {
  interfaceNumber: number
  alternate: { endpoints: USBEndpoint[] }
}
interface USBEndpoint {
  endpointNumber: number
  direction: "in" | "out"
}

// ============================================================================
// Servicios y características BLE comunes en impresoras térmicas
// ============================================================================
// La mayoría usan estos UUIDs estándar (Nordic UART o variantes).
// Si tu impresora usa otros, hay que descubrirlos con getPrimaryServices.
const BT_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Common thermal printer service
  "0000ff00-0000-1000-8000-00805f9b34fb", // Alternative
  "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 / similar BLE modules
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART Service
]

// ============================================================================
// API unificada
// ============================================================================

export interface ConnectedPrinter {
  kind: "bluetooth" | "usb"
  name: string
  print(data: Uint8Array): Promise<void>
  disconnect(): Promise<void>
}

const STORAGE_KEY = "orvex-thermal-printer-kind"

export function getLastUsedKind(): "bluetooth" | "usb" | null {
  if (typeof window === "undefined") return null
  const v = localStorage.getItem(STORAGE_KEY)
  return v === "bluetooth" || v === "usb" ? v : null
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator
}

export function isUSBSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator
}

/**
 * Conecta a impresora por Bluetooth. Abre el picker del browser para que el
 * usuario elija la suya. Devuelve un handle con .print() listo para mandar
 * bytes ESC/POS.
 */
export async function connectBluetooth(): Promise<ConnectedPrinter> {
  if (!isBluetoothSupported()) {
    throw new Error("Tu navegador no soporta Bluetooth. Probá con Chrome o Edge actualizados.")
  }

  // Aceptamos todos los dispositivos (algunas térmicas no anuncian service
  // específico en el advertisement, así que filtramos por nada y dejamos al
  // usuario elegir). Sí declaramos los services optionales para poder
  // accederlos después.
  const nav = navigator as Navigator & {
    bluetooth: {
      requestDevice(options: {
        acceptAllDevices?: boolean
        filters?: Array<{ services?: string[]; namePrefix?: string }>
        optionalServices?: string[]
      }): Promise<BluetoothDevice>
    }
  }

  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: BT_SERVICES,
  })

  if (!device.gatt) throw new Error("La impresora no expone GATT.")

  const server = await device.gatt.connect()

  // Probamos los services conocidos en orden hasta encontrar uno escribible
  let writeChar: BluetoothRemoteGATTCharacteristic | null = null
  for (const serviceUuid of BT_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid)
      const chars = await service.getCharacteristics()
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          writeChar = c
          break
        }
      }
      if (writeChar) break
    } catch {
      // service no existe en este device, probar el siguiente
    }
  }

  // Si ninguno de los services conocidos funcionó, buscar genérico
  if (!writeChar) {
    const services = await server.getPrimaryServices()
    for (const service of services) {
      const chars = await service.getCharacteristics()
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          writeChar = c
          break
        }
      }
      if (writeChar) break
    }
  }

  if (!writeChar) {
    server.disconnect()
    throw new Error("No encontré ninguna característica escribible en la impresora.")
  }

  localStorage.setItem(STORAGE_KEY, "bluetooth")

  const characteristic = writeChar
  const useWriteWithoutResponse = characteristic.properties.writeWithoutResponse

  return {
    kind: "bluetooth",
    name: device.name ?? "Impresora Bluetooth",
    async print(data: Uint8Array) {
      // BLE tiene MTU chico (típico 20 bytes en GATT estándar, 512 en
      // versiones modernas). Mandamos en chunks de 100 bytes para
      // compatibilidad amplia.
      const CHUNK_SIZE = 100
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE)
        if (useWriteWithoutResponse && characteristic.writeValueWithoutResponse) {
          await characteristic.writeValueWithoutResponse(chunk)
        } else {
          await characteristic.writeValue(chunk)
        }
        // Pausa chica para no saturar el buffer del printer
        await new Promise((r) => setTimeout(r, 20))
      }
    },
    async disconnect() {
      try {
        server.disconnect()
      } catch {
        // ignore
      }
    },
  }
}

/**
 * Conecta a impresora por USB. Mismo flow que BT pero usa WebUSB.
 */
export async function connectUSB(): Promise<ConnectedPrinter> {
  if (!isUSBSupported()) {
    throw new Error("Tu navegador no soporta WebUSB. Probá con Chrome o Edge en desktop.")
  }

  const nav = navigator as Navigator & {
    usb: {
      requestDevice(options: { filters: Array<Record<string, number>> }): Promise<USBDevice>
    }
  }

  // Filtros vendor IDs comunes: 0x04b8 EPSON, 0x0416 Bixolon, 0x0fe6 Generic,
  // 0x28e9 Xprinter, 0x1fc9 NXP/Goojprt. acceptAllDevices con array vacío.
  const device = await nav.usb.requestDevice({ filters: [] })

  await device.open()
  if (!device.configuration) await device.selectConfiguration(1)
  const intf = device.configuration?.interfaces[0]
  if (!intf) throw new Error("No encontré una interfaz USB en la impresora.")

  await device.claimInterface(intf.interfaceNumber)

  // Buscar endpoint OUT
  const endpoint = intf.alternate.endpoints.find((e) => e.direction === "out")
  if (!endpoint) {
    await device.close()
    throw new Error("La impresora no tiene endpoint OUT.")
  }

  localStorage.setItem(STORAGE_KEY, "usb")

  return {
    kind: "usb",
    name: device.productName ?? device.manufacturerName ?? "Impresora USB",
    async print(data: Uint8Array) {
      await device.transferOut(endpoint.endpointNumber, data)
    },
    async disconnect() {
      try {
        await device.close()
      } catch {
        // ignore
      }
    },
  }
}
