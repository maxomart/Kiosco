# KioscoApp — Guía de instalación

## Stack tecnológico

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Frontend | **Next.js 14** (App Router) | SSR, fast, PWA-ready |
| UI | **Tailwind CSS + shadcn/ui** | Rápido de construir, responsivo |
| Estado | **Zustand** | Liviano, persiste el carrito |
| Backend | **Next.js API Routes** | Un solo repo, sin servidor separado |
| Base de datos | **PostgreSQL + Prisma** | Confiable, type-safe |
| Autenticación | **NextAuth v5** | Roles, sesiones, seguro |
| Offline | **Dexie.js** (IndexedDB) | Sigue vendiendo sin internet |
| Gráficos | **Recharts** | Dashboards y estadísticas |

---

## Instalación paso a paso

### 1. Clonar y entrar al proyecto
```bash
cd kiosco-app
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar la base de datos

**Opción A: PostgreSQL local con Docker (recomendado para desarrollo)**
```bash
docker run --name kiosco-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=kiosco_db \
  -p 5432:5432 \
  -d postgres:16
```

**Opción B: Supabase (gratis, para producción)**
1. Crear cuenta en supabase.com
2. Nuevo proyecto → copiar la "Connection string" (URI)

### 4. Variables de entorno
```bash
cp .env.example .env
# Editar .env con tu DATABASE_URL y un NEXTAUTH_SECRET seguro
```

Para generar un NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### 5. Crear las tablas y cargar datos de prueba
```bash
npm run db:push    # Crea las tablas en la DB
npm run db:seed    # Carga usuarios y productos de ejemplo
```

### 6. Ejecutar en desarrollo
```bash
npm run dev
```

Abrir: **http://localhost:3000**

---

## Credenciales iniciales

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Dueño | admin@kiosco.com | admin123 |
| Cajero | cajero@kiosco.com | cajero123 |

> ⚠️ **Cambiar las contraseñas en producción**

---

## Estructura del proyecto

```
kiosco-app/
├── app/
│   ├── (auth)/login/           ← Pantalla de login
│   ├── (dashboard)/
│   │   ├── page.tsx            ← Dashboard principal
│   │   ├── pos/                ← Punto de venta (POS)
│   │   ├── inventario/         ← Gestión de productos
│   │   ├── reportes/           ← Estadísticas y reportes
│   │   ├── clientes/           ← Base de clientes
│   │   ├── proveedores/        ← Proveedores
│   │   ├── caja/               ← Gestión de caja
│   │   ├── cargas/             ← Recargas y servicios
│   │   └── configuracion/      ← Ajustes del negocio
│   └── api/
│       ├── productos/          ← CRUD de productos
│       ├── ventas/             ← Registro de ventas
│       ├── caja/               ← Sesiones de caja
│       ├── clientes/           ← CRUD de clientes
│       └── reportes/           ← Endpoints de reportes
├── components/
│   ├── pos/                    ← POS, carrito, pago, escáner
│   ├── inventario/             ← Tabla y modal de productos
│   ├── dashboard/              ← Widgets y gráficos
│   └── shared/                 ← Sidebar, header, etc.
├── store/
│   └── posStore.ts             ← Estado del carrito (Zustand)
├── lib/
│   ├── auth.ts                 ← NextAuth config
│   ├── db.ts                   ← Prisma client
│   ├── utils.ts                ← Helpers (moneda, fechas, etc.)
│   └── offline/db.ts           ← Base de datos offline (Dexie)
└── prisma/
    ├── schema.prisma           ← Modelo de datos completo
    └── seed.ts                 ← Datos de ejemplo
```

---

## Módulos implementados en el scaffold

### ✅ Completamente funcionales
- **Login** con roles (dueño / cajero)
- **POS / Caja** completo:
  - Búsqueda instantánea de productos
  - Escáner de código de barras (USB + manual)
  - Carrito con descuentos por ítem y global
  - 7 formas de pago
  - Cálculo automático de vuelto
  - Modo offline (guarda la venta en IndexedDB)
- **Inventario**:
  - Listado con filtros y ordenamiento
  - Alta/baja/modificación de productos
  - Alertas visuales de stock bajo
  - Cálculo automático de ganancia
- **Dashboard**:
  - Ventas del día y mes
  - Gráfico de ventas por hora
  - Alertas de stock bajo
  - Últimas ventas
- **Base de datos** completa (18 modelos)
- **APIs** para productos y ventas con validación

### 🚧 Para construir próximamente
- Módulo de reportes (Excel/PDF)
- Gestión de clientes y fidelidad
- Gestión de proveedores y compras
- Recargas/cargas (Claro, Movistar, SUBE)
- Cierre de caja con arqueo
- Facturación electrónica AFIP
- Impresora térmica de tickets
- Notificaciones WhatsApp/email

---

## Comandos útiles

```bash
npm run dev          # Desarrollo
npm run build        # Build producción
npm run db:studio    # Ver la BD visualmente (Prisma Studio)
npm run db:migrate   # Aplicar migraciones en producción
npm run db:seed      # Recargar datos de prueba
```

---

## Deploy en producción

### Vercel + Supabase (recomendado, gratis)
1. Push el código a GitHub
2. Importar en vercel.com
3. Agregar variables de entorno
4. Deploy automático

### VPS Argentina (para más control)
```bash
# En el servidor (Ubuntu)
npm run build
npm start
# Usar PM2 para mantenerlo vivo:
pm2 start npm --name "kiosco" -- start
```

---

## Soporte para escáner de barras USB

Los escáneres USB actúan como teclado → el código se ingresa automáticamente en el campo de búsqueda del POS. No requiere driver ni configuración adicional.

## Impresora térmica

Para imprimir tickets, usar `react-to-print` o `@react-pdf/renderer`. El endpoint de ventas devuelve todos los datos necesarios para generar el ticket.

---

*KioscoApp v0.1 · Hecho en Argentina 🇦🇷*
