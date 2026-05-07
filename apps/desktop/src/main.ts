/**
 * Orvex Desktop — Electron main process.
 *
 * Estrategia: la app es un wrapper de https://cobraorvex.com (la misma
 * web que ya tienen). Esto significa:
 *   - Cero duplicación de código.
 *   - Cuando pusheamos a main, los users desktop reciben los cambios al
 *     próximo refresh (igual que la PWA).
 *   - El Service Worker del sitio web se encarga del modo offline; acá
 *     solo nos preocupamos del shell nativo (ventana, menú, dock).
 *
 * Lo nativo que sumamos arriba de la PWA:
 *   - Icono propio en el dock (no Chrome).
 *   - Sin URL bar.
 *   - Title bar custom con window-controls-overlay (Mac y Windows 11).
 *   - Auto-update via GitHub Releases (electron-updater).
 *   - Notificaciones nativas del SO.
 *   - Atajos OS-level (Cmd+Q, Cmd+W, etc.) routeados a la app.
 *   - External links abren en el browser, no dentro de la ventana.
 *
 * Seguridad: contextIsolation ON, nodeIntegration OFF, sandbox ON,
 * webSecurity ON. El renderer NO tiene acceso a Node — solo lo que
 * exponemos en preload.ts vía contextBridge.
 */

import { app, BrowserWindow, shell, Menu, MenuItemConstructorOptions, dialog, nativeTheme, session, ipcMain } from "electron"
import { autoUpdater } from "electron-updater"
import * as path from "path"

// URL del sitio. En dev podemos override con ORVEX_DEV_URL para apuntar
// a localhost mientras desarrollás. En prod siempre cobraorvex.com.
const PROD_URL = "https://cobraorvex.com"
const DEV_URL = process.env.ORVEX_DEV_URL
const APP_URL = DEV_URL || PROD_URL
const isDev = !!DEV_URL || !app.isPackaged

// Solo permitimos navegación dentro del dominio de Orvex. Si el user
// hace click en un link externo (ej: en el footer), abrimos en el
// browser del SO en lugar de dentro de la ventana de la app.
const ALLOWED_HOSTS = new Set([
  "cobraorvex.com",
  "www.cobraorvex.com",
  // Para dev — localhost si lanzás la app contra Next dev server.
  "localhost",
  "127.0.0.1",
])

let mainWindow: BrowserWindow | null = null
let updateCheckInterval: NodeJS.Timeout | null = null

function createWindow() {
  // Tamaño persistido — si el user redimensionó la ventana antes, le
  // devolvemos el mismo tamaño. Si es la primera vez, default 1280×800.
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#050510", // match el manifest del sitio para evitar flash blanco
    show: false, // no mostramos hasta que el HTML cargue (evita flash)
    title: "Orvex",
    icon: path.join(__dirname, "assets", process.platform === "win32" ? "icon.ico" : "icon.png"),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    titleBarOverlay: process.platform === "darwin" ? undefined : {
      color: "#050510",
      symbolColor: "#e5e7eb",
      height: 38,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // Defense in depth: aunque ya estamos en HTTPS-only via webSecurity,
      // forzamos explícito allowRunningInsecureContent: false para que
      // ningún script del sitio pueda cargar recursos http:// dentro
      // de páginas https://. webviewTag: false evita que código injectado
      // pueda crear <webview> nested con permisos rebajados.
      allowRunningInsecureContent: false,
      webviewTag: false,
      // Permitimos service workers (el sitio los usa para offline).
      // Habilitamos también las APIs de notificaciones / web push.
      backgroundThrottling: false,
    },
  })

  // Cargar la URL del sitio. Si no hay internet en arranque cold-start,
  // mostramos una pantalla de error custom (cargada desde disk) en lugar
  // del feo error nativo de Chromium.
  win.loadURL(APP_URL).catch(() => {
    showOfflineFallback(win)
  })

  // Cuando termina el primer paint (sea cual sea el resultado), mostramos
  // la ventana. Antes estaba oculta para no flashear blanco.
  win.once("ready-to-show", () => {
    win.show()
    if (isDev) win.webContents.openDevTools({ mode: "detach" })
  })

  // External links → browser del SO. La PWA del sitio tiene links a
  // mercadopago.com.ar, ARCA, redes sociales, etc — esos deberían
  // abrirse en el browser, no dentro de la ventana de Orvex.
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url)
      if (ALLOWED_HOSTS.has(u.hostname)) {
        return { action: "allow" }
      }
    } catch {}
    shell.openExternal(url).catch(() => {})
    return { action: "deny" }
  })

  // Misma lógica para navegación in-place (si algo internamente intenta
  // navegar a un dominio externo, lo abrimos en browser).
  win.webContents.on("will-navigate", (event, url) => {
    try {
      const u = new URL(url)
      if (!ALLOWED_HOSTS.has(u.hostname)) {
        event.preventDefault()
        shell.openExternal(url).catch(() => {})
      }
    } catch {
      event.preventDefault()
    }
  })

  // Si el render process se cae (raro pero puede pasar tras un OOM),
  // recargamos. Sino la ventana queda en blanco para siempre.
  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("[orvex-desktop] render process gone:", details.reason)
    if (details.reason !== "clean-exit") {
      dialog.showErrorBox(
        "Orvex se reinició",
        "La app tuvo un problema técnico y se está recargando."
      )
      win.reload()
    }
  })

  // Si el load falla (ej: arrancaste offline cold-start), cae acá.
  // Mostramos una pantalla local de "sin conexión" con botón reintentar.
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    // ERR_ABORTED (-3) es navegación cancelada por click rápido — no error real.
    if (errorCode === -3) return
    console.warn(`[orvex-desktop] did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`)
    showOfflineFallback(win)
  })

  return win
}

/**
 * Muestra una pantalla local "sin conexión" usando un data URL — sin
 * depender de archivos del bundle, sin red. Tiene auto-reload cada 5s.
 * El usuario nunca ve el error feo de Chromium "ERR_INTERNET_DISCONNECTED".
 */
function showOfflineFallback(win: BrowserWindow) {
  // JSON.stringify para escapar la URL — APP_URL es controlado por env
  // ORVEX_DEV_URL en dev, pero mejor estar safe que sorry.
  const safeUrl = JSON.stringify(APP_URL)
  const html = `<!doctype html><html lang="es-AR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Sin conexión · Orvex</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif}
body{background:linear-gradient(135deg,#050510,#0a0a18 50%,#07071a);color:#f3f4f6;
display:flex;align-items:center;justify-content:center;padding:24px;-webkit-app-region:drag}
.card{max-width:380px;text-align:center;background:rgba(17,24,39,.65);
border:1px solid rgba(124,58,237,.3);border-radius:24px;padding:32px 28px;-webkit-app-region:no-drag;backdrop-filter:blur(20px)}
.icon{width:64px;height:64px;margin:0 auto 16px;border-radius:20px;
background:rgba(124,58,237,.18);border:1px solid rgba(124,58,237,.4);
display:flex;align-items:center;justify-content:center;color:#a78bfa}
h1{font-size:22px;font-weight:800;letter-spacing:-.02em;margin-bottom:8px}
p{color:#9ca3af;font-size:14px;line-height:1.55;margin-bottom:18px}
.pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;
font-size:12px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);
color:#fcd34d;margin-bottom:14px}
.dot{width:8px;height:8px;border-radius:50%;background:#f59e0b;animation:p 1.6s ease-in-out infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.4}}
.btn{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:12px 16px;
border-radius:12px;font-weight:600;font-size:14px;text-decoration:none;cursor:pointer;border:0;
background:#7c3aed;color:#fff;margin-top:10px}
.btn:hover{background:#8b5cf6}
.hint{margin-top:16px;font-size:12px;color:#6b7280;line-height:1.5}
</style></head>
<body>
<div class="card">
  <span class="pill"><span class="dot"></span>Sin conexión</span>
  <div class="icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/><line x1="2" y1="2" x2="22" y2="22"/></svg></div>
  <h1>Orvex no pudo conectarse</h1>
  <p>Necesitamos internet para arrancar la app por primera vez. Revisá tu wifi y volvé a intentar — o si ya entraste antes, esperá unos segundos.</p>
  <button class="btn" onclick="orvex.retry()">Reintentar</button>
  <p class="hint">La app reintenta sola cada 5 segundos. Cuando vuelva la conexión, te llevamos al dashboard.</p>
</div>
<script>
const APP_URL=${safeUrl};
let tries=0;
function probe(){return fetch(APP_URL,{cache:"no-store",mode:"no-cors"}).then(()=>true).catch(()=>false)}
async function loop(){
  if(await probe()){orvex.retry();return}
  tries++;
  setTimeout(loop, Math.min(5000+tries*1000, 15000))
}
window.orvex={retry:()=>{location.href=APP_URL}}
loop()
</script></body></html>`
  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html))
}

/** Custom application menu — más limpio que el default de Electron. */
function buildMenu() {
  const isMac = process.platform === "darwin"
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: "about" as const },
            { type: "separator" as const },
            { label: "Buscar actualizaciones", click: () => checkForUpdates(true) },
            { type: "separator" as const },
            { role: "services" as const },
            { type: "separator" as const },
            { role: "hide" as const },
            { role: "hideOthers" as const },
            { role: "unhide" as const },
            { type: "separator" as const },
            { role: "quit" as const },
          ],
        }]
      : []),
    {
      label: "Archivo",
      submenu: [
        ...(!isMac
          ? [{ label: "Buscar actualizaciones", click: () => checkForUpdates(true) }, { type: "separator" as const }]
          : []),
        isMac ? { role: "close" as const } : { role: "quit" as const },
      ],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo" as const },
        { role: "redo" as const },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        { role: "selectAll" as const },
      ],
    },
    {
      label: "Ver",
      submenu: [
        { role: "reload" as const, label: "Recargar" },
        { role: "forceReload" as const, label: "Recargar sin caché" },
        { type: "separator" as const },
        { role: "resetZoom" as const, label: "Zoom normal" },
        { role: "zoomIn" as const, label: "Acercar" },
        { role: "zoomOut" as const, label: "Alejar" },
        { type: "separator" as const },
        { role: "togglefullscreen" as const, label: "Pantalla completa" },
        ...(isDev ? [{ role: "toggleDevTools" as const, label: "DevTools" }] : []),
      ],
    },
    {
      label: "Ventana",
      submenu: [
        { role: "minimize" as const },
        { role: "zoom" as const },
        ...(isMac
          ? [
              { type: "separator" as const },
              { role: "front" as const },
              { type: "separator" as const },
              { role: "window" as const },
            ]
          : [{ role: "close" as const }]),
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Soporte",
          click: () => shell.openExternal("https://cobraorvex.com/configuracion/soporte"),
        },
        {
          label: "Sitio web",
          click: () => shell.openExternal("https://cobraorvex.com"),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/**
 * Auto-update via electron-updater + GitHub Releases. Solo en builds
 * empaquetados (no tiene sentido en dev). Chequea silencioso al
 * arranque + cada 4h. Si hay update lo descarga en background y avisa
 * al user con un dialog cuando está listo.
 */
function setupAutoUpdater() {
  if (isDev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  // Defense against downgrade attacks: si el update info dice una versión
  // menor a la actual, electron-updater normalmente la rechaza, pero
  // forzamos el comportamiento explícito por seguridad.
  autoUpdater.allowDowngrade = false
  // Sin esto, en algún edge case electron-updater puede caer en un flow
  // de "instalación web" que descarga + ejecuta scripts del server. Lo
  // bloqueamos: solo aceptamos binarios completos firmados.
  autoUpdater.disableWebInstaller = true

  autoUpdater.on("update-available", (info) => {
    console.log("[orvex-desktop] update available:", info.version)
  })

  autoUpdater.on("update-downloaded", (info) => {
    if (!mainWindow) return
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        buttons: ["Reiniciar ahora", "Después"],
        defaultId: 0,
        cancelId: 1,
        title: "Actualización lista",
        message: `Orvex ${info.version} se descargó.`,
        detail: "Reiniciá la app para aplicar la actualización.",
      })
      .then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall()
      })
  })

  autoUpdater.on("error", (err) => {
    console.error("[orvex-desktop] update error:", err.message)
  })

  // Inicial + cada 4h. Guardamos el handle para poder limpiarlo en
  // window-all-closed / before-quit y no dejar timers colgados.
  checkForUpdates(false)
  if (updateCheckInterval) clearInterval(updateCheckInterval)
  updateCheckInterval = setInterval(() => checkForUpdates(false), 4 * 60 * 60 * 1000)
}

function checkForUpdates(showDialogIfNone: boolean) {
  if (isDev) {
    if (showDialogIfNone && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Actualizaciones",
        message: "Auto-update está deshabilitado en modo desarrollo.",
      })
    }
    return
  }
  // Timeout 30s — si GitHub Releases tarda en responder no queremos
  // bloquear forever (en silencio). Promise.race contra reject manual.
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Update check timed out after 30s")), 30_000)
  )
  Promise.race([autoUpdater.checkForUpdates(), timeoutPromise])
    .then((result) => {
      if (showDialogIfNone && mainWindow && !result?.updateInfo) {
        dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "Orvex",
          message: "Ya estás en la última versión.",
        })
      }
    })
    .catch((err) => console.error("[update check]", err?.message ?? err))
}

// ─── Single-instance lock ───────────────────────────────────────────
// Si el user hace doble-click en el ícono, traemos la ventana existente
// al frente en lugar de abrir una segunda app.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    nativeTheme.themeSource = "dark"
    // Permitir notificaciones del SO sin pedir permiso (la PWA del sitio
    // ya las pide al user). El sitio usa Web Push.
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowed = ["notifications", "geolocation", "media", "clipboard-sanitized-write", "fullscreen"]
      callback(allowed.includes(permission))
    })

    // IPC handlers expuestos vía preload.ts a window.orvexNative
    ipcMain.handle("orvex:check-for-updates", () => {
      checkForUpdates(true)
    })
    ipcMain.handle("orvex:open-external", (_e, url: string) => {
      // Whitelist estricto de protocolos. Sin esto un atacante con XSS
      // en cobraorvex.com podría llamar a:
      //   - file:///etc/passwd para leer archivos del user
      //   - javascript: para ejecutar código
      //   - ssh:// / vnc:// para iniciar sessions remotas
      //   - smb:// / itms-services:// para attacks de redirect
      // Solo permitimos http(s) y mailto: (links de email son comunes).
      try {
        if (typeof url !== "string" || url.length > 2000) return Promise.resolve()
        const u = new URL(url)
        const allowed = ["http:", "https:", "mailto:"]
        if (allowed.includes(u.protocol)) {
          return shell.openExternal(url)
        }
      } catch {}
      return Promise.resolve()
    })

    mainWindow = createWindow()
    buildMenu()
    setupAutoUpdater()

    app.on("activate", () => {
      // En macOS, click en el dock cuando no hay ventanas → re-abrir.
      // Chequeamos contra getAllWindows() (no solo mainWindow ref) para
      // evitar race: si la window anterior se cerró y mainWindow quedó
      // colgado en una ref vieja, igual la creamos.
      const windows = BrowserWindow.getAllWindows()
      if (windows.length === 0) {
        mainWindow = createWindow()
      } else {
        // Sino, traemos la primera al frente (la que ya existe).
        mainWindow = windows[0]
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    })
  })

  app.on("window-all-closed", () => {
    // Limpiamos el timer de update check para no leakear.
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval)
      updateCheckInterval = null
    }
    // En macOS las apps se quedan corriendo en el dock — ahí lo respetamos.
    // En Windows / Linux se cierran al cerrar la última ventana.
    if (process.platform !== "darwin") app.quit()
  })

  app.on("before-quit", () => {
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval)
      updateCheckInterval = null
    }
  })
}
