# Plan: migrar imágenes de DB → storage externo

## Problema actual

Hoy guardamos imágenes (logos de tenant + fotos de productos) como
**data URLs base64** dentro de la propia columna del modelo:

- `TenantConfig.logoUrl` → ~30 KB
- `Product.image` → ~25-50 KB c/u

Tradeoffs:

| Pros | Contras |
|------|---------|
| Cero setup externo | DB se infla rápido (200 productos × 30 KB = 6 MB/tenant) |
| Atomicidad: borrar producto borra la imagen | JSON de productos pesa 5-10x más, ralentiza el POS |
| No hay que firmar URLs | No hay CDN — cada device se descarga full payload |
| | Backups de Postgres se vuelven gigantes y caros |

Con > 50 tenants × 200 productos esto se vuelve crítico. Tenemos que
mover las imágenes a object storage externo y guardar sólo la URL.

## Opciones de proveedor

### Vercel Blob (recomendado para velocidad de implementación)
- API simple: `put(filename, file, { access: 'public' })` → devuelve URL
- Sin config de bucket, sin keys de IAM
- CDN integrado
- Costo: ~$0.15 / GB-mes + bandwidth (≈ $5/mes para nuestro tamaño)
- **Limitación**: no funciona fuera de Vercel sin pago. Nosotros estamos
  en Railway. Hay que confirmar si Vercel Blob acepta peticiones de fuera
  o si conviene cambiar de host.

### Cloudflare R2 (recomendado para costo)
- S3-compatible API (usar `@aws-sdk/client-s3` o `aws4fetch`)
- **Sin egress fees** (gran diferencia vs S3/Vercel Blob)
- Costo: ~$0.015 / GB-mes storage + $0 egress
- Tiene que configurarse un bucket + token API → 10 min de setup en
  Cloudflare dashboard
- Custom domain: `images.cobraorvex.com` apuntando al bucket

### Railway Volume + Next /api/image
- Guardar archivos en un volumen persistente de Railway
- Servirlos desde un endpoint propio (`/api/image/[id]`)
- **Sin CDN** → cada request impacta el servidor
- Más complejo, peor performance. **No recomendado**.

**Mi voto: Cloudflare R2.** Egress free es enorme para una app que cada
device baja todas las fotos de productos.

## Plan de migración

### Fase 1 — agregar storage (mantener compatibilidad)
1. Crear bucket R2 + token API + dominio custom (manual, 10 min)
2. Agregar env vars: `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`
3. Nuevo helper `lib/storage.ts` con `uploadImage(file, key)` y
   `deleteImage(key)`
4. Actualizar `components/inventario/ProductModal.tsx` y `LogoSection`:
   en lugar de guardar `data:image/...;base64,...` en el form, subir el
   blob a R2 y guardar la URL pública en `Product.image` / `TenantConfig.logoUrl`

### Fase 2 — migrar datos existentes
- Script `scripts/migrate-images-to-r2.js`:
  - Iterar todos los products/configs con `image` que empiece con `data:`
  - Decodificar base64
  - Subir a R2 con key estable (ej. `products/{tenantId}/{productId}.jpg`)
  - Actualizar la columna con la URL pública
  - Log de progreso + idempotente (si ya migró, skip)
- Correr una vez en producción con backup previo

### Fase 3 — limpiar
- Confirmar que ninguna columna tiene `data:` URLs
- Deploy el código nuevo que asume URLs externas
- Borrar el código viejo de base64

## Estimación

- Fase 1: 4-6 horas (setup R2 + helper + uploaders)
- Fase 2: 2 horas (script + corrida)
- Fase 3: 1 hora (deploy + verificación)

Total: ~1 día.

## Riesgo: ¿qué pasa si R2 cae?

R2 tiene SLA 99.9%. Si cae, los nuevos uploads fallan (mostramos error
al usuario). Las imágenes ya hosteadas siguen sirviendo desde Cloudflare
CDN. Recovery: reintentar más tarde.

Para mitigarlo más, podríamos hacer fallback temporal a base64 en DB
cuando R2 falla, pero suma complejidad — no lo haría hasta que algún
cliente lo pida.
