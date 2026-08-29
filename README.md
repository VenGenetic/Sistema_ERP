# Sistema ERP — LV Parts

ERP de repuestos usados/importados: catálogo, inventario por bodega, punto de
venta, finanzas de partida doble, demandas de repuestos y una bandeja de
WhatsApp para vender desde el mismo sistema.

Es una SPA de React + Vite. **No hay servidor propio**: todo el backend es
Supabase (Postgres, Auth, Storage y RPCs), y buena parte de la lógica de
negocio vive en la base (ver `supabase/migrations/`), no en el cliente.

## Requisitos

- Node.js 20 o superior
- Un proyecto de Supabase (el esquema está en `supabase/migrations/`)

## Puesta en marcha

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear un archivo `.env` en la raíz (no se versiona) con las claves del
   proyecto de Supabase — Project Settings → API:

   ```
   VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
   VITE_SUPABASE_ANON_KEY=<clave anon>
   ```

   Los scripts de mantenimiento de `scripts/` necesitan además la clave de
   servicio, que **solo se usa fuera del navegador**:

   ```
   SUPABASE_SERVICE_ROLE_KEY=<clave service_role>
   ```

   > La clave `service_role` salta todas las políticas de RLS. Nunca va en el
   > código ni en el bundle: solo en `.env`, y `.env` está en `.gitignore`.

3. Levantar el entorno de desarrollo:

   ```bash
   npm run dev          # http://localhost:3000
   ```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en el puerto 3000 |
| `npm run build` | Build de producción |
| `npm run preview` | Sirve el build de producción |
| `npm run check-contrast` | Verifica el contraste (WCAG) de los tokens de color |
| `npm run sync-products` | Trae el catálogo de productos desde Odoo |
| `npm run sync-importer-stock` | Sincroniza el stock de la importadora |
| `npm run feed:meta` | Genera el feed de productos para Meta |

No hay linter ni tests configurados. El chequeo de tipos se corre a mano:

```bash
npx tsc --noEmit
```

## Estructura

```
App.tsx              tabla de rutas (escritorio y móvil, con HashRouter)
pages/               páginas de escritorio
pages/mobile/        app móvil, implementación aparte bajo /mobile
components/          componentes; ui/ son las primitivas del sistema de diseño
store/               estado con Zustand, uno por módulo (POS, POE, proformas…)
utils/               reglas de negocio y helpers del cliente
supabase/migrations/ esquema y lógica en Postgres (fuente de la verdad)
design-system/       especificación visual (el modo móvil tiene la suya)
scripts/             mantenimiento y migraciones puntuales de datos
```

## Despliegue

Vercel, como sitio estático. `vercel.json` reescribe todo a `index.html`
porque el enrutado es del lado del cliente.

## Documentación

- `CLAUDE.md` — guía de arquitectura para trabajar en el repo
- `MAPA_ARQUITECTURA_COMPLETO.md` — mapa de capas
- `schema.md` — diagrama entidad-relación
- `Salesflow.md` y `Salest team Payment logic.md` — reglas de comisiones y
  puntos del equipo de ventas (no están codificadas en ningún otro lado)
- `agente/docs/responder-desde-el-erp.md` (repo hermano) — cómo sale un
  mensaje de WhatsApp desde el ERP
