# Análisis competitivo — Mercado de POS / SaaS para retail en Argentina

> Última actualización: 2026-04. Vivo y editable según evoluciona el mercado.

## Competidores principales

| Producto | Segmento | Precio aprox/mes | Fortalezas | Debilidades |
|---|---|---|---|---|
| **Tango Gestión** | Empresas medianas | $60-200 | ERP completo, AFIP nativo, líder histórico | Desktop, complejo, lento, vendido como software |
| **Bsale** (Chile/AR) | Retail chico-mediano | $30-80 | UI moderna, multi-país, AFIP, soporte ok | Caro para kioscos, sin IA, soporte responde lento |
| **Fudo** | Gastronomía | $25-60 | MP integrado, mobile, comandera | Solo restaurantes, no retail general |
| **Loyverse** | Kioscos / micro | Free + addons | Free POS, mobile-first, scanner cámara | Sin AFIP, traducción mala, soporte foreign |
| **Geocom** | Kioscos legacy | $20-40 | AFIP, presencia, conoce el rubro | UI vieja, no SaaS, instalación |
| **Errezeta** | Kioscos AR | $15-30 | Liviano, enfocado AR, AFIP | UI básica, sin IA, sin móvil |
| **Increase** | Empresas | $80+ | ERP + facturación + fintech | Para empresas medianas, no retail chico |
| **Tiendanube** | E-commerce | $20-50 | UI top, AFIP, ecosistema | No es POS verdadero, solo online |
| **Mercado Pago Punto** | Pagos | Free + comisión | Factura electrónica gratis, terminal | Sin POS real, sin inventario, locked-in MP |

## Lo que TODOS tienen y nosotros NO

| Feature | Estado RetailAR | Prioridad |
|---|---|---|
| AFIP factura electrónica (CAE) | 🟡 Schema listo, falta integración | **CRÍTICO** |
| MercadoPago QR / checkout real | 🟡 Solo método declarativo | **CRÍTICO** |
| Lector de código de barras USB | 🟢 Funciona (input field) | Listo |
| Lector con cámara móvil | 🔴 Falta | ALTA |
| Impresión de tickets térmicos 80mm | 🔴 Falta | **ALTA** |
| Cuenta corriente clientes | 🟡 Schema listo | **ALTA** |
| Modo offline | 🔴 Falta | MEDIA |
| App móvil / PWA installable | 🔴 Falta | ALTA |
| Combos / promociones | 🟡 Schema listo | MEDIA |
| Productos con variantes (talle/color) | 🔴 Falta | BAJA |
| Backup automático | 🔴 Falta | BAJA |
| Stock multi-depósito | 🔴 Falta | BAJA |

## Lo que NOSOTROS tenemos y la competencia NO (moat)

| Feature | Loyverse | Bsale | Geocom | RetailAR |
|---|---|---|---|---|
| Asistente IA con contexto del negocio | ❌ | ❌ | ❌ | ✅ |
| Notificaciones por WhatsApp nativas | ❌ | ❌ | ❌ | ✅ |
| Multi-tenant SaaS Next.js 16 | ❌ legacy | 🟡 | ❌ | ✅ |
| Theme picker (color de marca) | ❌ | ❌ | ❌ | ✅ |
| Plan FREE con upgrade path claro | 🟡 | ❌ trial | ❌ | ✅ |
| Roles + permisos granulares | ❌ | ✅ | ❌ | ✅ |
| Panel admin SuperAdmin (CRUD avanzado) | ❌ | 🟡 | ❌ | ✅ |
| API pública con tokens | ❌ | 🟡 | ❌ | ✅ |
| Insights automáticos (rule-based) | ❌ | ❌ | ❌ | ✅ |

## Roadmap de features para ganarle al mercado

### Sprint 0 — IMPRESCINDIBLES (sin esto perdés las ventas)

- [x] Schema AFIP en Sale + TenantConfig
- [x] Schema cuenta corriente en Client + ClientPayment model
- [x] Schema Combo + ComboItem
- [ ] Integración AFIP via TusFacturas.app (REST simple)
- [ ] PDF factura formato AFIP completo (con logo, leyenda, QR)
- [ ] MercadoPago QR generation (Point Smart / Point Plus)
- [ ] Receipt printing 80mm (PDF + window.print() + ESC/POS opcional)
- [ ] Cuenta corriente: UI de pagos, balance, alertas
- [ ] PWA: manifest + service worker + installable

### Sprint 1 — DIFERENCIADORES

- [ ] Combos / promociones aplicadas en POS
- [ ] Lector de código con cámara (mobile)
- [ ] Modo offline para POS (IndexedDB sync)
- [ ] Variantes de producto (talle, color, modelo)
- [ ] Stock multi-depósito (separar lo del local vs depósito)
- [ ] Comprobantes A/B/C/M con elección automática según condición IVA cliente

### Sprint 2 — VALOR AGREGADO

- [ ] Backup automático a Drive / S3
- [ ] Integración con bancos para conciliación
- [ ] Reportes a medida con queries SQL
- [ ] Marketplace de plugins (recetas, e-commerce sync)
- [ ] App móvil nativa para owner (React Native)
- [ ] WhatsApp Business catalog sync

### Sprint 3 — ENTERPRISE

- [ ] Multi-tienda real (refactor Tenant→Account→Store)
- [ ] Franquicias (consolidación)
- [ ] Reportes consolidados cross-tienda
- [ ] Permisos por tienda
- [ ] Transferencias de stock entre tiendas

## Estrategia de pricing vs mercado

```
                        BÁSICO          MEDIO         AVANZADO       ENTERPRISE
Loyverse        Free + $9 addons       N/A             N/A           N/A
Geocom              $20-40                              $80+
Errezeta            $15-30
Bsale                                $30-80                          $150+
Tango                                                               $60-200
Fudo                                 $25-60

RetailAR        Free → $25 (Starter) → $60 (Pro) → $150 (Business)
```

**Nuestro posicionamiento**:
- **Free** beats Loyverse en features pero limita el escalado
- **Starter $25** es competitivo con Geocom/Errezeta + features modernos
- **Professional $60** compite con Bsale pero con mejor IA + WhatsApp
- **Business $150** se mete a competirle a Tango con UX moderna

## Posicionamiento de marketing

- **"El POS más inteligente para tu kiosco"** — IA es la palanca
- **"Atendé tu negocio desde WhatsApp"** — diferenciador único
- **"AFIP de un click"** — pain point #1 resuelto
- **"Sin instalación, sin contrato"** — vs Tango/Geocom
- **"Hecho en Argentina, para Argentina"** — vs Loyverse/Bsale

## Canales de adquisición probados en este mercado

- **Google Ads** — kw "POS kiosco", "sistema gestión almacén" (caro pero alta intent)
- **Facebook/Instagram Ads** — orgánico via Reels mostrando uso real
- **YouTube tutoriales** — los kiosqueros buscan "cómo facturar electrónicamente"
- **Cámara de Comerciantes** — partnerships locales
- **Influencers de pyme** — Sebas Castellanos, Pyme Argentina, etc.
- **Foros como Pyme.com.ar, Argentina Comercial**
- **WhatsApp grupos de comerciantes**
