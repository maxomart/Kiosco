# Orvex Desktop

Wrapper Electron de [cobraorvex.com](https://cobraorvex.com). Distribuye Orvex como app nativa para macOS, Windows y Linux con auto-update integrado.

## Architecture

La app NO duplica código del sitio web. Es una `BrowserWindow` que carga `https://cobraorvex.com` con shell nativo arriba:

- Icono propio en el dock / start menu (no Chrome)
- Sin URL bar, sin pestañas
- Title bar custom con window-controls-overlay
- Auto-update via GitHub Releases
- Notificaciones nativas del SO
- Single-instance lock (doble-click no abre dos ventanas)
- Offline fallback con auto-reconnect cada 5s

## Dev

```bash
cd apps/desktop
npm install
npm run dev    # apunta a http://localhost:3000 (Next dev server)
npm start      # apunta a https://cobraorvex.com (producción)
```

## Build local

```bash
npm run dist:mac    # crea .dmg + .zip en build/
npm run dist:win    # crea .exe (NSIS installer + portable)
npm run dist:linux  # crea .AppImage + .deb
npm run dist:all    # los tres targets
```

## Release a producción

Los releases se generan automáticamente con el workflow GitHub Actions
(`.github/workflows/desktop-release.yml`) cuando se pushea un tag `v*`.

```bash
# Bumpear versión en package.json
npm version patch  # o minor / major

# Pushear el tag — el workflow corre solo
git push --follow-tags
```

El workflow:
1. Builda en macOS (Intel + ARM), Windows (x64), Linux (x64) en paralelo
2. Sube los artefactos a un GitHub Release con tag `v<version>`
3. Genera el `latest-mac.yml` / `latest.yml` / `latest-linux.yml` que
   `electron-updater` consume para auto-update

## Code signing

**macOS:** requiere cuenta Apple Developer ($99/año). Con cuenta:

```bash
export CSC_LINK=/path/to/certs.p12
export CSC_KEY_PASSWORD=...
export APPLE_ID=...
export APPLE_APP_SPECIFIC_PASSWORD=...
export APPLE_TEAM_ID=...
npm run dist:mac
```

Sin firma la app igual funciona pero el user tiene que hacer
**click derecho → Abrir** la primera vez (warning de Gatekeeper).

**Windows:** opcional. Sin firma el SmartScreen de Windows muestra
warning las primeras veces. Para firmarla:

```bash
export WIN_CSC_LINK=/path/to/cert.pfx
export WIN_CSC_KEY_PASSWORD=...
npm run dist:win
```

## Iconos

Necesarios en `src/assets/`:
- `icon.png` (512×512, transparente — para Linux + base)
- `icon.icns` (macOS — usar [iconutil](https://stackoverflow.com/a/20703594) o `electron-icon-builder`)
- `icon.ico` (Windows)
- `dmg-background.png` (540×380, opcional — fondo del .dmg)

Si no existen, electron-builder usa default Electron logo (feo). Para
generar todos desde un PNG:

```bash
npx electron-icon-builder --input=src/assets/icon-master.png --output=src/assets
```

## Notas técnicas

**Por qué wrapper en lugar de bundle estático:**
- Cero duplicación. Los users desktop reciben mejoras al toque.
- El SW del sitio sigue funcionando — offline-first ya está resuelto.
- Si querés bundle estático en el futuro, exportá Next como SPA y
  cambiá `loadURL` por `loadFile`.

**Por qué Electron y no Tauri:**
- Tauri da binarios más livianos pero pone WebView nativo del OS, lo
  que significa diferencias entre plataformas. Electron (Chromium) es
  consistente.
- Electron tiene infra madura: electron-builder, auto-updater, code
  signing recipes. Tauri todavía está catching up.
- Si Orvex crece y el bundle de 100MB se vuelve un problema, migrar
  a Tauri es un proyecto separado.

**Security model:**
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  `webSecurity: true`. El renderer (sitio web) NO puede tocar Node.
- Solo lo que está en `preload.ts` queda expuesto vía
  `window.orvexNative`. Hoy: platform, version, openExternal, checkUpdates.
- External links abren en browser del SO — el sitio no puede navegar a
  un dominio que no sea `cobraorvex.com`.
