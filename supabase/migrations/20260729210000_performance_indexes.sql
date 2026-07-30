-- Performance: índices faltantes en columnas usadas constantemente en
-- WHERE/ORDER BY/JOIN por el frontend (Dashboard, Inventory, ProductDemands,
-- Orders) y búsqueda por substring (ilike) en products.
--
-- Todo aquí es aditivo (IF NOT EXISTS) y no cambia ningún comportamiento de
-- la app: solo acelera lecturas que hoy hacen sequential/full scan a medida
-- que las tablas crecen. Seguro de aplicar en cualquier momento.

-- ── inventory_logs: sin ningún índice más allá de la PK hasta ahora.
-- Usado por Inventory.tsx (pestaña "movements") filtrando y ordenando por
-- estas columnas, y por el dashboard para el gráfico de ingresos/salidas.
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_warehouse_id ON inventory_logs(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON inventory_logs(created_at);

-- ── product_demands: ordenado por created_at en cada carga de la pantalla
-- (ProductDemands.tsx), filtrado por status y por product_id en varios
-- triggers/queries. Solo existía el índice único parcial de (phone_number,
-- product_id).
CREATE INDEX IF NOT EXISTS idx_product_demands_created_at ON public.product_demands(created_at);
CREATE INDEX IF NOT EXISTS idx_product_demands_status ON public.product_demands(status);
CREATE INDEX IF NOT EXISTS idx_product_demands_product_id ON public.product_demands(product_id);

-- ── orders: created_at y closer_id ya estaban indexados
-- (20260403233000_dashboard_optimizations.sql). Faltaban status y
-- customer_id, usados para filtrar el listado de pedidos y el historial de
-- compras por cliente.
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- ── Búsqueda por substring (ilike '%term%') en products.name / products.sku
-- (Products.tsx, POS.tsx, Inventory.tsx). Un índice B-tree normal (como
-- idx_products_sku, que ya existe) no sirve para wildcard inicial: hace
-- falta pg_trgm + índice GIN para que Postgres pueda usar índice en vez de
-- recorrer la tabla completa en cada tecleo del buscador.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON products USING gin (sku gin_trgm_ops);

NOTIFY pgrst, 'reload schema';
