# 🟣 Orvex — Multi-Tenant POS SaaS

> A full-featured point-of-sale platform for Argentine businesses — live in production with paying clients at [cobraorvex.com](https://cobraorvex.com).

![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_GPT--4o-412991?style=flat&logo=openai&logoColor=white)
![Status](https://img.shields.io/badge/status-live%20in%20production-brightgreen)

**Live product:** [cobraorvex.com](https://cobraorvex.com)

---

## What is Orvex?

Orvex is a multi-tenant SaaS built end to end for Argentine retail businesses. It handles the full point-of-sale workflow: product and inventory management, electronic invoicing compliant with AFIP/ARCA regulations, payment processing via MercadoPago, and AI-powered features using OpenAI GPT-4o.

Each client gets their own isolated tenant environment. The platform is in active production with real paying clients.

---

## Key Features

- **Multi-tenant architecture** — isolated data per business, shared infrastructure
- **AFIP/ARCA electronic invoicing** — legally compliant invoicing for Argentina (Factura A, B, C)
- **MercadoPago integration** — card payments, QR, and installment plans
- **AI features via GPT-4o** — smart product descriptions, sales insights, and customer support automation
- **Android companion app** — mobile POS for sales staff on the floor
- **Role-based access** — admin, manager, and cashier roles with granular permissions
- **Real-time dashboard** — sales metrics, inventory alerts, and revenue tracking
- **Multi-branch support** — manage multiple store locations from one account

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) · React · TypeScript |
| Styling | Tailwind CSS · shadcn/ui |
| Backend | Next.js API Routes · Node.js |
| Database | PostgreSQL · Prisma ORM |
| AI | OpenAI GPT-4o (chat completions + function calling) |
| Payments | MercadoPago SDK |
| Invoicing | AFIP/ARCA WSFE web service |
| Auth | NextAuth.js |
| Mobile | Android (companion app) |
| Deployment | Vercel + Railway |

---

## Architecture Overview

```
Orvex/
├── app/
│   ├── (auth)/               # Login, registration
│   ├── (dashboard)/          # Main app — multi-tenant routing
│   │   ├── products/         # Product & inventory management
│   │   ├── sales/            # POS interface & transaction flow
│   │   ├── invoicing/        # AFIP/ARCA electronic invoice generation
│   │   ├── payments/         # MercadoPago integration
│   │   └── ai/               # GPT-4o powered features
│   └── api/                  # API routes
├── prisma/
│   └── schema.prisma         # Multi-tenant data model
├── lib/
│   ├── afip.ts               # AFIP/ARCA WSFE client
│   ├── mercadopago.ts        # Payment processing
│   └── openai.ts             # AI integration
└── components/               # Shared UI components
```

---

## Screenshots

> *Screenshots available at [cobraorvex.com](https://cobraorvex.com)*

---

## Production Status

- **Deployed and live** at [cobraorvex.com](https://cobraorvex.com)
- Serving real paying clients in Argentina
- 350+ production deployments
- Integrated with AFIP/ARCA for legal invoicing compliance

---

## Author

Built by [Joaquín](https://github.com/maxomart) — Full Stack Developer specializing in production SaaS and AI integrations.

> **Note:** This repository contains the source code for a live production product. Some environment-specific configurations and credentials are not included.
