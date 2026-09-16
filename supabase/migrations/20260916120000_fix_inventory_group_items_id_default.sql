-- El INSERT de "Guardar sin Aplicar" / "Finalizar y Aplicar" (persistItemCounts
-- en pages/InventorySession.tsx) no manda la columna `id`: deja que Postgres la
-- rellene con su DEFAULT. En la base remota esa columna quedó sin DEFAULT
-- (la tabla de 20260722_inventory_groups.sql sí lo declaraba, así que en algún
-- momento se recreó o se hizo DROP DEFAULT a mano), y cada intento de guardar
-- una sesión de inventario moría con:
--   null value in column "id" of relation "inventory_group_items"
--   violates not-null constraint
--
-- Idempotente: si el DEFAULT ya está, SET DEFAULT lo deja igual.
ALTER TABLE public.inventory_group_items
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Mismo blindaje para la tabla padre, que se creó en la misma migración.
ALTER TABLE public.inventory_groups
    ALTER COLUMN id SET DEFAULT gen_random_uuid();
