/**
 * Traducción de errores típicos de AFIP/ARCA a mensajes en humano + sugerencias
 * de qué hacer. Los errores raw de AFIP son crípticos (códigos numéricos,
 * mensajes en spanglish, stack traces de Java).
 *
 * Convención del retorno:
 *   { title, hint, severity, action? }
 *   - title: mensaje principal en argentino para mostrar al user
 *   - hint: 1-2 oraciones explicando qué hacer
 *   - severity: "fatal" (no se puede continuar) | "warning" (sigue pero ojo) | "info"
 *   - action?: { label, href } para botón con link al portal correspondiente
 */

export interface FriendlyAfipError {
  title: string
  hint: string
  severity: "fatal" | "warning" | "info"
  action?: { label: string; href: string }
  raw?: string
}

interface ErrorPattern {
  match: RegExp
  build: (raw: string) => FriendlyAfipError
}

/**
 * Catálogo de errores conocidos. El primer pattern que matchea gana.
 * Orden importa: poner los más específicos arriba.
 */
const PATTERNS: ErrorPattern[] = [
  // CUIT inactivo en AFIP
  {
    match: /cuit\s*inactiva/i,
    build: () => ({
      title: "Tu CUIT no está activo en AFIP",
      hint: "Necesitás estar inscripto en Monotributo o Responsable Inscripto para emitir facturas. Andá a https://monotributo.afip.gob.ar/ y adherite (tarda ~15 min).",
      severity: "fatal",
      action: {
        label: "Adherir a Monotributo",
        href: "https://monotributo.afip.gob.ar/",
      },
    }),
  },
  // Alias ya existe (WSASS)
  {
    match: /alias\s+ya\s+existe/i,
    build: () => ({
      title: "Ya existe un certificado con ese alias",
      hint: "Cambiá el alias (agregá un sufijo tipo -v2 o un número) o regenerá el cert con uno distinto.",
      severity: "warning",
    }),
  },
  // Token expirado / inválido
  {
    match: /token.*(expir|inv[aá]lid)/i,
    build: () => ({
      title: "Token de AFIP expirado",
      hint: "Se renueva automáticamente — refrescá la página y volvé a intentar.",
      severity: "warning",
    }),
  },
  // CUIT no autorizado / no en relaciones
  {
    match: /no apareci[oó] cuit en lista de relaciones|no autoriza|sin permiso/i,
    build: (raw) => ({
      title: "El CUIT no está autorizado para este servicio",
      hint: "Asegurate de haber asociado tu certificado al servicio wsfe en WSASS (paso 'Crear autorización a servicio'). Si cambiaste de CUIT recientemente, los tokens viejos pueden interferir — guardá cualquier cambio en la configuración y se limpian solos.",
      severity: "fatal",
      raw,
    }),
  },
  // Falta cert/key
  {
    match: /falta(n)?\s+(cert|certificad|key|private)/i,
    build: () => ({
      title: "Faltan credenciales AFIP",
      hint: "Subí tu cert digital (.crt) y tu private key (.key) en la sección 'Modo guiado' o 'Modo manual'.",
      severity: "fatal",
    }),
  },
  // Cert vencido
  {
    match: /cert.*venc|expired/i,
    build: () => ({
      title: "Tu certificado venció",
      hint: "Generá uno nuevo desde la sección 'Modo guiado' — solo tarda 5 minutos.",
      severity: "fatal",
    }),
  },
  // Sin PV configurado
  {
    match: /punto.*venta|pos\s+no.*encontrad/i,
    build: () => ({
      title: "Punto de venta inválido o no dado de alta",
      hint: "En el portal de AFIP, dale de alta un PV tipo 'Web Services' y poné acá ese número. En homologación podés usar 1 sin trámite.",
      severity: "fatal",
      action: {
        label: "Administración de PV AFIP",
        href: "https://serviciosweb.afip.gob.ar/genericos/puntosVenta/Tramite/Index.aspx",
      },
    }),
  },
  // Quota agotada
  {
    match: /quota|cuota.*excedid|limit.*exceed|reached.*limit/i,
    build: () => ({
      title: "Llegaste al límite mensual de facturas de tu plan",
      hint: "Esperá al 1° del próximo mes o subí de plan.",
      severity: "warning",
      action: {
        label: "Ver planes",
        href: "/configuracion/suscripcion",
      },
    }),
  },
  // Encrypted cert no descifrable
  {
    match: /invalid pem|pem.*invalid|certificate.*invalid|format.*invalid/i,
    build: () => ({
      title: "El certificado está corrupto o mal pegado",
      hint: "Asegurate de copiar el cert completo, incluyendo las líneas -----BEGIN CERTIFICATE----- y -----END CERTIFICATE-----. Volvé a generarlo si dudás.",
      severity: "fatal",
    }),
  },
  // Connection / network
  {
    match: /econnref|enotfound|timeout|network|socket|getaddrinfo/i,
    build: () => ({
      title: "No se pudo contactar a AFIP",
      hint: "Puede ser que AFIP esté caído (suele pasar a la madrugada y los lunes a la mañana) o que tu conexión tenga un corte. Esperá 2-3 minutos y reintentá.",
      severity: "warning",
      action: {
        label: "Estado servicios AFIP",
        href: "https://www.afip.gob.ar/sitio/externos/default.asp",
      },
    }),
  },
  // AFIP server status response no OK
  {
    match: /appserver|dbserver|authserver/i,
    build: (raw) => ({
      title: "Hay un servicio de AFIP caído",
      hint: `AFIP nos dice: ${raw}. No es nuestro, hay que esperar a que lo levanten.`,
      severity: "warning",
      raw,
    }),
  },
  // AfipSDK / axios error message
  {
    match: /request failed with status code 400/i,
    build: () => ({
      title: "AfipSDK rechazó la operación",
      hint: "Suele ser por clave fiscal incorrecta, alias ya usado o cuota de AfipSDK agotada. Probá con el modo guiado (no usa AfipSDK).",
      severity: "fatal",
    }),
  },
  {
    match: /request failed with status code 5\d\d/i,
    build: () => ({
      title: "AfipSDK no responde",
      hint: "Su servicio puede estar caído. Probá con el modo guiado (no depende de AfipSDK) o esperá 5 min.",
      severity: "warning",
    }),
  },
  // Validación CSR / formato
  {
    match: /csr|certificate request|pkcs.?10/i,
    build: () => ({
      title: "El pedido de certificado (CSR) está mal formado",
      hint: "Regeneralo desde 'Modo guiado'. Si copiaste a mano, probá darle al botón 'Copiar' que copia el bloque entero limpio.",
      severity: "fatal",
    }),
  },
]

/**
 * Convierte un mensaje de error raw (típicamente del lado AFIP) a un mensaje
 * útil para mostrar al usuario.
 *
 * Si no matchea ningún pattern conocido, devuelve el raw como title con un
 * hint genérico.
 */
export function explainAfipError(raw: string | null | undefined): FriendlyAfipError {
  if (!raw || !raw.trim()) {
    return {
      title: "Error desconocido",
      hint: "No nos llegó un mensaje específico. Intentá de nuevo en un momento, y si sigue pasando, sacale screenshot al banner de error en /configuracion/afip y mandanos por chat.",
      severity: "warning",
    }
  }
  for (const p of PATTERNS) {
    if (p.match.test(raw)) {
      return { ...p.build(raw), raw }
    }
  }
  return {
    title: "AFIP devolvió un error que no reconocemos",
    hint: "Sacale screenshot al banner y mandanos por chat para identificarlo. Mientras tanto, probá refrescar y reintentar.",
    severity: "warning",
    raw,
  }
}
