# Assets — iconos del wrapper desktop

electron-builder espera estos archivos en este folder:

- `icon.png` (512×512, transparente) — Linux + base
- `icon.icns` (macOS — bundle con varios tamaños)
- `icon.ico` (Windows — multi-resolución)
- `dmg-background.png` (540×380, opcional — fondo del .dmg)
- `entitlements.mac.plist` ✅ ya existe — entitlements de seguridad para hardenedRuntime

## Cómo generarlos rápido desde un PNG master

1. Diseñá un PNG cuadrado de 1024×1024 (o usá el logo de Orvex `public/icons/icon-512.png`).
2. Corrélo:
   ```bash
   npx electron-icon-builder --input=src/assets/icon-master.png --output=src/assets
   ```
3. Eso te genera `icon.png`, `icon.icns`, `icon.ico` automáticamente.

## ¿Qué pasa si no están?

electron-builder usa el ícono default de Electron (azul-celeste con átomo).
La app igual builda y funciona — los iconos solo afectan look & feel del
ejecutable instalado.

Para no bloquear el primer release, está OK arrancar sin iconos custom y
agregarlos en una iteración posterior.
