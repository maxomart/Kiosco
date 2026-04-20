# Cómo enlazar Mercado Pago — guía paso a paso

RetailAR usa Mercado Pago **para dos cosas distintas**. Cada una se configura en un lugar diferente:

| ¿Para qué? | Quién paga | Quién cobra | Dónde se configura |
|---|---|---|---|
| **A) Cobrar las suscripciones** del SaaS | Tu cliente (el kiosquero) | **Vos** (RetailAR) | Variables de entorno de Railway |
| **B) Cobrar a los clientes del kiosco con QR** | Cliente final del kiosco | **El kiosquero** (cada tenant) | Configuración → Mercado Pago dentro del POS |

---

## A) Cobrar las suscripciones — TU cuenta MP

Esto te lo cobra MP a vos por hacer SaaS. Lo configurás UNA SOLA VEZ.

### 1. Crear tu cuenta de empresa en MP

- Andá a https://www.mercadopago.com.ar
- Si ya tenés cuenta personal, podés usarla; si no, registrate como **empresa** (te pide CUIT).
- **Si vendés a empresas que necesitan factura A**, dale de alta como Responsable Inscripto en el panel de MP también.

### 2. Crear la "aplicación" de developer

- Andá a https://www.mercadopago.com.ar/developers
- Click "Tus integraciones" → "Crear aplicación"
- Tipo: "**Pagos online**" → "Suscripciones"
- Producto: "Pagos online y presenciales"
- Modelo de integración: "Checkout Pro / Suscripciones"
- Dale un nombre tipo "RetailAR Billing"

### 3. Copiar las credenciales

En el panel de la aplicación creada vas a ver dos pestañas:

- **Test (modo sandbox)** — usar mientras pruebas
- **Producción** — usar cuando vayas a cobrar en serio

Necesitás:
- **Access Token** (empieza con `APP_USR-...` en producción, `TEST-...` en sandbox)
- Anotalo en un lugar seguro

### 4. Pegarlas en Railway

En Railway → tu proyecto → Variables → "Nueva variable":

```
MP_PLATFORM_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxx
```

Generá el secreto del webhook (otra variable, este lo inventás vos):

```bash
# Desde tu terminal:
openssl rand -hex 48
```

Copiá lo que sale y pegalo:

```
MP_WEBHOOK_SECRET=<lo que salió de openssl>
```

### 5. Registrar el webhook en MP

- Volvé al panel de developer → tu app → "Webhooks"
- Click "Configurar notificaciones"
- URL: `https://TU-DOMINIO-RAILWAY/api/billing/mp/webhook`
- Eventos: marcá ✅ **Pagos** y ✅ **Suscripciones (Preapproval)**
- Secreto: pegá el mismo `MP_WEBHOOK_SECRET` que pusiste en Railway
- Guardar

### 6. Probar

- Hacé deploy en Railway (el commit nuevo de variables fuerza redeploy)
- Logueate como un tenant tuyo en plan FREE
- Andá a Configuración → Suscripción
- Click "Pagar con Mercado Pago" en cualquier plan
- Te lleva a la página de MP — pone una tarjeta de **prueba** si estás en modo TEST:
  - Visa: `4509 9535 6623 3704`
  - Vencimiento: cualquier futuro
  - CVV: `123`
  - DNI: `12345678`
- Confirmá el pago
- Volvés a tu app → tendrías que ver la suscripción activa en pocos segundos
- Mirá los logs de Railway: tienen que aparecer las notificaciones de MP que llegan al webhook

### Comisiones que te cobra MP

- **Suscripciones**: 4,99% + IVA = ~6% por cada cobro recurrente
- Liquidación: instantánea a tu cuenta MP
- Después transferís de MP → tu banco (sin comisión, $0,01 mínimo)

---

## B) Cobrar a clientes del kiosco con QR

Esto es para que cada kiosquero (cada tenant) cobre a SUS clientes desde el POS escaneando un QR. **Cada cliente conecta su propia cuenta de MP** — vos no tocás nada.

### Lo que el kiosquero hace (le explicás esto en tu onboarding)

1. Tener cuenta MP propia (el comerciante).
2. En MP → Developers → "Tus integraciones" → "Crear aplicación" → tipo "**Pagos online**" → "Checkout Pro".
3. Copiar el **Access Token de Producción** (empieza con `APP_USR-...`).
4. En RetailAR → Configuración → Mercado Pago → pegarlo y guardar.
5. **Test rápido**: botón "Probar conexión" en la misma página → te crea un pago fake de $1 a tu propia cuenta para confirmar que anda.

### Lo que pasa cuando se hace una venta

1. Cajero pone método de pago "Mercado Pago"
2. La app crea una **preference** en la cuenta MP del kiosquero (con su token)
3. Aparece un QR en pantalla
4. Cliente escanea con la app de MP → paga → MP confirma
5. La app polling cada 3s detecta el "approved" → confirma la venta automáticamente
6. Botón fallback "Ya cobré" por si la conexión es lenta

### Comisiones que MP le cobra al kiosquero

- **QR (Cuenta MP)**: 0% (paga con saldo MP)
- **Tarjeta de débito**: 0,80% + IVA
- **Tarjeta de crédito**: 4,99% + IVA (1 pago) — más por cuotas

---

## Errores comunes

### "401 invalid_token" o "401 unauthorized"
→ El access token está mal o es de otro ambiente (mezclaste TEST con PROD). Volvelo a copiar del panel de MP.

### "MP_WEBHOOK_SECRET no configurado" en logs
→ Te falta esa variable en Railway. Generala con `openssl rand -hex 48` y pegala.

### "Webhook responde 401"
→ El secret en Railway y en el panel de webhooks de MP no coinciden. Asegurate de pegar el MISMO en los dos lugares.

### Pagos en modo TEST no funcionan en PROD
→ Las suscripciones reales necesitan el token `APP_USR-`. El `TEST-` solo sirve para sandbox.

### "No me llegó la confirmación" después del pago
→ El webhook no llegó. Probá en MP → Tus integraciones → Webhooks → "Histórico" para ver si hubo error. Verificá la URL pública sin barras finales.

### Quiero ver pagos manualmente
→ MP → Movimientos → ahí tenés todo lo cobrado.

---

## Roadmap MP

- [ ] Soporte cuotas en suscripción (hoy es solo recurrente mensual)
- [ ] Trial de 14 días via `free_trial` en preapproval
- [ ] Webhook signature en formato nuevo (MP cambió el formato en 2025)
- [ ] Refunds desde el panel admin
- [ ] Multi-país: Mercado Pago México, Brasil, etc.
