# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install              # install deps
npm run dev               # Vite dev server on :3000 (host 0.0.0.0)
npm run build              # production build (vite build)
npm run preview            # preview a production build

npm run sync-products        # scripts/sync-odoo-products.js — pulls product catalog from Odoo
npm run sync-importer-stock  # scripts/sync-importer-stock.js — syncs stock from importer/vendor source
```

There is no lint script, no test runner, and no `tsc` script wired into `package.json` (TypeScript is `noEmit`/checked by the editor and Vite's esbuild transform only — `npx tsc --noEmit` can be run manually to type-check but isn't part of the normal workflow).

Required env vars (`.env`, Vite-exposed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Node scripts under `scripts/` additionally need `SUPABASE_SERVICE_ROLE_KEY` — that key bypasses RLS, so it is read from `.env` only, never hardcoded and never shipped to the browser.

Deploys to Vercel as a static SPA (`vercel.json` rewrites everything to `index.html` — routing is client-side via `HashRouter`).

## Architecture

This is a single-page React app (no custom backend server) for a used-auto-parts dropship/inventory ERP, backed entirely by **Supabase** (Postgres + Auth + Storage + RPC). All data access goes through the Supabase JS client (`supabaseClient.ts`) directly from components — there is no API layer in this repo. `MAPA_ARQUITECTURA_COMPLETO.md` and `schema.md` have fuller diagrams (frontend/backend/data tiers and full ER diagram, in Spanish); read those for a deeper map before large changes.

### Two front-ends behind one router

`App.tsx` is the single route table for **both** a desktop app and a separate mobile app, split by `ProtectedRoute` (`components/ProtectedRoute.tsx`) using `utils/deviceDetection.ts` (`shouldRedirectToMobile`: user-agent/touch/screen-width heuristic, overridable per-session via `sessionStorage`). Desktop pages live in `pages/*.tsx` under `Layout`; mobile pages live in `pages/mobile/*.tsx` under `components/mobile/MobileLayout.tsx` at `/mobile/*`. They are largely independent implementations of overlapping features (e.g. inventory, catalog), not shared components — check `pages/mobile/` separately when a mobile-specific bug is reported. The mobile UI has its own design-system spec at `design-system/modo-movil-industrial/MASTER.md` (colors, spacing, motion, anti-patterns) — follow it for any mobile UI work, and check for a more specific `design-system/pages/[page-name].md` first if one exists.

All routes except `/login`, `/setup`, `/test-connection`, `/auth/*` are wrapped in `ProtectedRoute`, which gates on `AuthContext` (`contexts/AuthContext.tsx`).

### Auth and permissions

`AuthContext` loads the Supabase session plus the user's `profiles` row (joined to `roles.permissions`, a JSON permission map) and exposes role flags (`isAdmin`, `isCloser`, `isSourcingManager`, `isWarehouse`, `isSalesMonitor`) and a `permissions` object. **Note:** in the current code these role flags are hardcoded (`isAdmin = true`, the rest `false`) rather than derived from `userProfile.roles.name` — treat any role-gated logic as effectively "everyone is admin" until this is revisited.

Devices get a `device_session_id` in `localStorage`; `AuthContext` compares it against `profiles.current_session_id` (updated on login, watched via a Supabase Realtime subscription + focus events) to detect concurrent logins. The forced sign-out on session takeover is currently **disabled by explicit product decision** (multi-device concurrent POS access was requested) — the detection code path still runs and logs a warning instead of signing out; don't silently "fix" this back to aggressive sign-out.

### State management

Three Zustand stores, each scoped to one feature rather than a single global store:
- `store/cartStore.ts` — POS cart/checkout state
- `store/usePOEStore.ts` — the POE module (see below)
- `store/useInvoiceLabelsStore.ts` — invoice-label print queue

### Domain modules worth knowing by name

- **POS** (`pages/POS.tsx`, `components/pos/`) — point of sale / checkout flow, backed by `cartStore`.
- **POE** (`pages/POE.tsx`, `components/poe/`) — a specialized spreadsheet-like editor (`POETable`/`POECell`/`SidePeekConsole`, "Type A/B" editors) with its own Zustand store; treat as a distinct sub-app.
- **Order lifecycle** — `utils/orderStateMachine.ts` is the single source of truth for valid `OrderStatus` transitions and which `role_id` may act on which status. It says explicitly that it *mirrors* a Postgres `update_order_status` RPC (`supabase/migrations/`) — if you change transition rules, both sides need to move together.
- **Sourcing / demand / commissions** — `pages/SourcingPipeline.tsx`, `pages/ProductDemands.tsx`, `pages/CommissionDashboard.tsx`, `pages/Replenishment.tsx` implement the sales→sourcing→fulfillment→commission pipeline documented (in Spanish, as Mermaid flowcharts) in `Salesflow.md` and `Salest team Payment logic.md`: a Kanban handoff from sales quoting to back-office sourcing/PO/fulfillment, gamified point milestones per stage, points frozen until an invoice line is fully paid, monthly pool-based commission payout, and clawback on later returns/bad debt. Read those two files before touching commission/points logic — the rules are non-obvious and encoded nowhere else.
- **Finance** — `pages/Finance.tsx`, `components/FinanceDashboard.tsx`, `components/FinanceConfig.tsx`, double-entry-style `accounts`/`transactions`/`transaction_lines` tables (see `schema.md`).
- **Inventory** — `pages/Inventory.tsx`, `pages/InventoryMode.tsx` + `pages/InventorySession.tsx` (session-based stock counting flow), `pages/Tags.tsx`, warehouse-scoped stock in `inventory_levels`/`inventory_logs`, with grouping support (`inventory_groups`/`inventory_group_items`).
- **WhatsApp inbox** — `pages/WhatsAppInbox.tsx`, `components/whatsapp/`, `utils/whatsappOutbox.ts`. The parts-selling workstation: read the thread, reply with text/photos/files, send catalog products (photo + price), build and send a **proforma as an image**, register a demand, and push the quote into the POS cart to charge it. The proforma draft is **per conversation** (`store/useChatProformaStore.ts`) — deliberately not the global `useProformaStore`, which belongs to the POS flow; a seller juggling chats would otherwise quote one customer another's parts. `ProformaDocument.tsx` mirrors `ProformaPreviewModal`'s design on purpose, and "Cobrar en el POS" reuses `utils/proformaToCart.ts` rather than duplicating warehouse resolution. The browser has no WhatsApp session — everything is **enqueued** into `agent_outbox` and dispatched by a separate Node service that lives in the sibling `agente/` repo (Baileys, same Supabase project). Two rules are mirrored from that service and must move together with it: the customer price is `products.price` rounded **up** to the whole dollar (`utils/precioCliente.ts` — the single implementation, used by the share card, both proforma stores, the arrival notice and the demand ticket; `whatsappOutbox.ts` re-exports it), and importer stock doesn't count when `importer_unavailable_override` is set. Catalog search calls the service's own `agent_search_products` RPC (learned aliases + pg_trgm), not a local query, so the seller finds what the bot finds. `agente/docs/responder-desde-el-erp.md` documents the flow, the schema it needs, and why replying from the phone instead loses the conversation.

### Database

Schema lives entirely in `supabase/migrations/*.sql` (timestamp-ordered, applied via the Supabase CLI against the linked project — `supabase/config.toml`). There's a lot of business logic in Postgres (RPCs/triggers), not just tables — e.g. order status transitions, POS checkout, batch product entry, RLS policies are iterated on directly in migrations (several migrations exist purely to patch RLS: `fix_products_rls`, `fix_batch_entry`, `rls_lockdown`, etc.). When changing a flow that touches the DB, check for an existing RPC before adding client-side logic — much of the transactional/accounting logic intentionally lives server-side. `schema.md` (Mermaid ER diagram) gives the entity overview; treat migrations as the source of truth over it.

`apply-migration.js` connects to a local Supabase instance (`127.0.0.1:54322`) to run a single migration file manually (`node apply-migration.js supabase/migrations/<file>.sql`) — this is a dev convenience script, not part of the normal deploy path.

### Build

`vite.config.ts` manually chunks vendor/ui/supabase bundles and dynamic-imports `xlsx`/`jszip` at their call sites (Excel/ZIP export) to keep them out of the main bundle — preserve that pattern (don't add static top-level imports of `xlsx`/`jszip`/similar heavy libs). Console/debugger statements are stripped in production builds only.

### Repo hygiene note

The repo root has a lot of one-off scripts, exported data dumps, and scratch files (`scripts/`, `scratch/`, `inventario desorganizado/`, `graphify-out/`, `*.xlsx`, `refactor*.py`, `check_db.js`, `tsc_output.txt`, etc.) accumulated from past debugging/migration sessions. These are not part of the app's runtime and can generally be ignored unless a task specifically references one.

Those scripts read every credential from `.env` (`SUPABASE_SERVICE_ROLE_KEY` for the ones that bypass RLS) and fail loudly when it is missing. Never reintroduce a literal key as a fallback: this repo is public on GitHub, and a `service_role` key committed here grants full read/write on the whole Supabase project.
