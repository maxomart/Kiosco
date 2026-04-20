# Modelo de negocio — RetailAR

> Última actualización: 2026-04. Vivo y editable según ajustes de pricing y costos reales.

## Pricing en ARS (mercado AR)

| Plan | Precio/mes | USD aprox | Compite con |
|---|---|---|---|
| **Gratis** | $0 | $0 | Loyverse Free, Geocom demo |
| **Básico** (Starter) | **$9.999** | ~$10 USD | Errezeta básico, Geocom entrada |
| **Profesional** (Pro) | **$24.900** | ~$25 USD | Bsale básico, Geocom medio |
| **Negocio** (Business) | **$59.900** | ~$60 USD | Bsale Pro, Tango entry |

**Por qué pesos y no USD**:
- Confianza local (los kiosqueros no piensan en USD)
- Ajustes de inflación = revisar precios cada 3-6 meses (vs ajuste automático USD que asusta)
- Compliance AFIP simplificado (factura en pesos)

Si la inflación supera el 30% en 6 meses, ajustar precios:
- Básico: +20-30%
- Pro: +20-30%
- Business: +15-20% (menos elástico)

## Costos por usuario/mes (estimación realista)

### Costos variables

| Item | Cálculo | STARTER | PRO | BUSINESS |
|---|---|---|---|---|
| Railway hosting (compartido) | ~$0,01 USD/req prorrateado | $300 | $500 | $2.000 |
| OpenAI gpt-4o-mini | $0,15/$0,60 per 1M tok, ~1500 tok/msg | $30 | $300 | $3.000 |
| Twilio WhatsApp | ~$0,005 USD/msg | $50 | $200 | $500 |
| MP fee suscripción | 4,99% + IVA = ~6% | $600 | $1.500 | $3.600 |
| Storage (Postgres + assets) | $0,02 USD/GB/mes | $50 | $150 | $500 |
| Bandwidth | Railway free tier, después $0,10 USD/GB | $50 | $150 | $500 |
| **TOTAL COSTOS** | | **$1.080** | **$2.800** | **$10.100** |

### Margen bruto

| Plan | Revenue | Costos | Profit | Margen |
|---|---|---|---|---|
| Básico | $9.999 | $1.080 | **$8.919** | **89%** |
| Profesional | $24.900 | $2.800 | **$22.100** | **88%** |
| Negocio | $59.900 | $10.100 | **$49.800** | **83%** |

### Costos fijos de plataforma (independiente de cantidad de usuarios)

- Dominio: ~$15 USD/año = $1.500 ARS/mes
- Railway base: ~$5 USD/mes = $5.000 ARS/mes
- OpenAI base (proxy/security): negligible
- Anthropic / Claude API (futuro): TBD
- Soporte: tiempo del fundador (no monetizado al inicio)

**Punto de equilibrio**: 1 usuario STARTER cubre todos los costos fijos.

## Proyecciones de ingresos

Asumiendo distribución 60% Básico / 30% Pro / 10% Business:

| # Clientes pagos | Revenue mensual | Profit mensual | Profit anual |
|---|---|---|---|
| 10 | $194.500 | $170.400 | $2.04M |
| 50 | $972.500 | $852.000 | $10.2M |
| 100 | $1.945.000 | $1.704.000 | $20.4M |
| 200 | $3.890.000 | $3.408.000 | $40.9M |
| 500 | $9.725.000 | $8.520.000 | $102M |
| 1000 | $19.450.000 | $17.040.000 | $204M |
| 5000 | $97.250.000 | $85.200.000 | $1.022M |

**Conversión free→pago**: en SaaS B2B sano = 2-5%. Apuntando a 3%:
- 1.000 cuentas free → 30 pagas
- 10.000 cuentas free → 300 pagas
- 100.000 cuentas free → 3.000 pagas

### Mercado direccionable (TAM)

- **Argentina**: ~500.000 kioscos/almacenes/mini-súper/farmacias chicas
- **Penetración 0,5%**: 2.500 clientes pagos = ~$48M ARS/mes profit
- **Penetración 2%**: 10.000 clientes = ~$190M ARS/mes profit
- Latam expansion (Uruguay, Paraguay, Bolivia, Chile, México, Colombia): 5-10x el TAM

## Métricas a trackear

### Acquisition
- **CAC** (Customer Acquisition Cost) — meta: <30% del LTV
- Funnel: visitas → signup → activación → primer venta → pago

### Activación
- **% que hace primera venta** dentro de 7 días — meta: >60%
- **% que carga ≥10 productos** — meta: >50%

### Retention
- **Churn mensual** — meta: <5% para B2B (industria 5-7%)
- **Net Revenue Retention** — meta: >100% (upgrades > downgrades)

### Monetization
- **MRR** (Monthly Recurring Revenue)
- **ARPU** (Average Revenue Per User)
- **LTV** (LifeTime Value) = ARPU / churn

### Engagement
- **Daily Active Users / Monthly Active Users** — meta: >30%
- **Mensajes IA por usuario** (proxy de adopción)
- **% que usa WhatsApp alerts** (sticky feature)

## Estrategia de pricing dinámico

### Promociones

- **Lanzamiento**: 50% off primeros 3 meses para los primeros 100 clientes
- **Anual**: -20% pagando anual (mejora cashflow + reduce churn)
- **Referidos**: 1 mes gratis al referente + 30% off primer mes al referido
- **Upgrade**: cuando un FREE pega 3 paywalls en una semana, mostrar oferta personalizada (-20% primer mes)

### Trial
- Hoy: 14 días en planes pagos
- Considerar 30 días en Business (ciclo de venta más largo)

## Revenue streams alternativos (futuro)

1. **Marketplace de plugins** — desarrolladores externos venden extensiones, RetailAR cobra 15-30%
2. **Procesamiento de pagos pasthrough** — ofrecer tu propia pasarela con 2,5% (menor que MP) tomando 0,5% de margen
3. **Servicios pro**: setup asistido, migración desde Excel, capacitación = $50k-200k AR por servicio
4. **Datos agregados** — venderle a CPGs (Coca-Cola, Arcor) datos anónimos de tendencias = $$ a escala
5. **Crédito a kiosqueros** (vía partner fintech) — kiosco bien manejado tiene historial vendible para crédito de capital de trabajo

## Análisis de unidad económica (LTV/CAC)

Asumiendo:
- Churn mensual 4%
- LTV = 1/0,04 = 25 meses promedio
- ARPU = $19.450 ARS (ponderado del mix)

**LTV** = $19.450 × 25 = $486.250 ARS por cliente

**CAC objetivo** = LTV / 3 (regla SaaS) = ~$162.000 ARS por cliente

A ese CAC podés permitirte:
- Google Ads: ~$2k-5k AR por click qualified, conversión 1-3% = $66k-150k por cliente
- Sales rep: $300k/mes × 3 clientes/mes = $100k por cliente
- Influencer: $200k campaña × 5 clientes = $40k por cliente

**Todos los canales están en presupuesto**.
