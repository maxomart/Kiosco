/**
 * Preload script — corre en un mundo aislado entre el main process
 * (Node) y el renderer (web). Es la única forma segura de exponer
 * APIs nativas al sitio web cargado dentro de la ventana.
 *
 * Hoy expone una API mínima `window.orvexNative` que el sitio puede
 * usar para detectar que está corriendo dentro de la app desktop
 * (vs. una pestaña normal de Chrome). Sirve para:
 *   - Mostrar la versión de la app en el footer / about.
 *   - Habilitar features OS-only (ej: imprimir directo a la térmica).
 *   - Distinguir en analytics: app vs web.
 *
 * Si no es desktop, `window.orvexNative` no existe — el sitio chequea
 * `if (window.orvexNative)` antes de usar.
 */

import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("orvexNative", {
  /** Identifica el wrapper. El sitio usa esto para mostrar "App Desktop" en el header. */
  platform: process.platform as "darwin" | "win32" | "linux",
  isDesktopApp: true,
  /** Versión del wrapper Electron (no de Orvex web). Para about/diagnóstico. */
  appVersion: process.env.npm_package_version || "dev",

  /** Bridge async para pedirle al main process que chequee actualizaciones manualmente. */
  checkForUpdates: () => ipcRenderer.invoke("orvex:check-for-updates"),

  /** Abre URL externa en el browser del SO. */
  openExternal: (url: string) => ipcRenderer.invoke("orvex:open-external", url),
})

// Nota: NO exponemos `require`, `process` completo, ni filesystem.
// La superficie de ataque queda chica. Si el sitio remoto se comprometiera
// con XSS, el atacante NO puede tocar los archivos del user.
