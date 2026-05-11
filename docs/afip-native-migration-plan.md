# Plan: migrar de AfipSDK → AFIP nativo (híbrido)

## El problema

Plan Profesional Orvex: $24.900 ARS/mes (~USD 22).
Costo AfipSDK por las 500 facturas incluidas: USD 30/mes.
**→ Perdés USD 8 por cliente que llena su cuota.**

A 50 clientes activos facturando = USD 18.000/año en pérdida pura por
AfipSDK. No es sostenible para escalar.

## Solución recomendada: híbrido

No sacar AfipSDK 100%, sólo dejar de pagarle por factura.

| Operación | Hoy (AfipSDK) | Después (híbrido) | Ahorro |
|-----------|---------------|-------------------|--------|
| Emisión factura A/B/C | AfipSDK ($) | **AFIP nativo (gratis)** | ~USD 30 / 500 fact |
| Notas de crédito/débito | AfipSDK ($) | **AFIP nativo (gratis)** | proporcional |
| Creación de certificado X.509 | AfipSDK (~USD 0,01 c/u) | **Sigue AfipSDK** | n/a |

**Por qué dejar AfipSDK para certificados**: AFIP NO expone un webservice
público para crear certificados — sólo un portal web con clave fiscal.
AfipSDK lo automatiza via scraping. Sacarlo significa que cada cliente
nuevo tenga que generar/subir certificado a mano en AFIP, bajando
conversión 15-25% en onboarding del Plan Profesional.

## Ahorro proyectado

| Clientes activos × 500 fact/mes | Costo AfipSDK puro | Costo híbrido | Ahorro/mes |
|---------------------------------|-------------------|---------------|------------|
| 10                              | USD 300           | USD ~5        | USD 295    |
| 50                              | USD 1.500         | USD ~25       | USD 1.475  |
| 100                             | USD 3.000         | USD ~50       | USD 2.950  |

## Lo que hay que implementar

### WSAA (Web Service Autenticación y Autorización)
- Generar Login Ticket Request (XML firmado con certificado del cliente)
- Mandar a `https://wsaahomo.afip.gov.ar/ws/services/LoginCms` (homo)
  o `https://wsaa.afip.gov.ar/ws/services/LoginCms` (prod)
- Parsear Token + Sign del response (validez 12 hs)
- Cachear TA por tenant + endpoint para no re-firmar cada call

**~4-6 hrs**

### WSFE (Web Service Factura Electrónica)
- `FECAESolicitar` → emitir factura, pedir CAE
- `FECompUltimoAutorizado` → para saber el último número emitido
- `FEParamGetPtosVenta` → listar puntos de venta habilitados
- `FECAEAConsultar` → consultar emitidas
- Mapeo de tipos de comprobante (1=Factura A, 6=Factura B, 11=Factura C,
  3=Nota Crédito A, 8=NC B, 13=NC C, 2=ND A, 7=ND B, 12=ND C, 51=M, etc.)

**~10-14 hrs**

### Integración con código existente
- Reemplazar llamadas en `app/api/afip/request-cae/route.ts`
- Reemplazar llamadas en `lib/afip-credit-note.ts`
- Mantener `app/api/configuracion/afip/create-cert/route.ts` con AfipSDK
- Manejar fallback: si AFIP nativo falla, usar AfipSDK como backup

**~3-4 hrs**

### Testing
- Homologación AFIP (sandbox) con CUIT de testing antes de producción
- Casos: factura A a RI, B a CF, C de monotributo, NC, ND
- Edge cases: certificado expirado, TA expirado, número de comprobante
  fuera de secuencia, condición IVA inválida

**~4-6 hrs**

### Total: 21-30 hrs = 3-5 días de dev intensivo

## Lo que necesito para arrancar (cuando quiera dale)

1. **CUIT de homologación** (uno de testing — generás uno en el portal
   de homologación de AFIP, separado del de producción).
2. **Certificado de homologación X.509** (lo generamos juntos en la
   primera sesión, AfipSDK puede crear el de homo igual que el de prod).
3. **Confirmación**: que el endpoint actual `/api/afip/request-cae`
   esté OK como base para reescribir (es lo que tenemos hoy).

## Plan de sesiones

1. **Sesión 1**: WSAA + emisión factura A/B/C nativa. Testing homo.
   AfipSDK queda como fallback (sin remover) hasta confirmar todo OK.
2. **Sesión 2**: Notas de crédito/débito nativas.
3. **Sesión 3**: Verificación en producción con un CUIT real, sacar
   AfipSDK de emisión, dejar sólo para creación de cert.

## Cuándo arrancar

- **No urgente HOY**: con 0-5 clientes facturando, el costo es marginal.
- **URGENTE antes de marketing fuerte del Plan Profesional**: si te
  explota la promo y aparecen 50 clientes facturando 500/mes c/u, te
  fundís.
- **Mi recomendación**: hacerlo cuando llegues a ~10 clientes activos
  facturando, o cuando tengas un fin de semana libre para encararlo.

## Decisión

Cuando quieras arrancar, decime "dale con el plan AFIP nativo" + pasame
los 3 ítems del bloque "Lo que necesito para arrancar". Yo te guío
sesión por sesión.
