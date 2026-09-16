-- Backfill puntual: dejar que TODOS los productos existan en la bodega
-- "Guayaquil" y que todo el stock viva ahi.
--
-- Contexto: Modo Inventario cuenta contra una bodega concreta
-- (inventory_groups.warehouse_id). Un producto sin fila en inventory_levels
-- para esa bodega no tiene stock teorico contra el cual comparar, asi que el
-- conteo lo ve como "sobrante" aunque el stock exista en otra bodega.
--
-- Que hace, en orden y en una sola transaccion:
--   1. Registra en inventory_logs la salida de cada otra bodega.
--   2. Registra en inventory_logs la entrada equivalente a Guayaquil.
--   3. Deja en Guayaquil el total sumado de todas las bodegas, y crea la fila
--      (en 0) para los productos que no tenian stock en ninguna parte.
--   4. Pone en 0 las demas bodegas. Las filas se conservan, no se borran.
--
-- El total por producto no cambia: solo cambia de bodega. Es idempotente: al
-- correrlo dos veces no queda nada que mover, asi que no duplica logs.
DO $$
DECLARE
    v_gye INT;
    v_reason TEXT := 'Consolidacion de bodegas en Guayaquil';
    v_productos INT;
    v_movidos INT;
BEGIN
    SELECT id INTO v_gye
    FROM public.warehouses
    WHERE lower(trim(name)) = 'guayaquil'
    ORDER BY id
    LIMIT 1;

    IF v_gye IS NULL THEN
        RAISE EXCEPTION 'No existe una bodega llamada "Guayaquil" en public.warehouses. Creala primero (o corrige el nombre) y vuelve a correr esto.';
    END IF;

    -- 1. Salida de las otras bodegas (se registra ANTES de tocar el stock).
    INSERT INTO public.inventory_logs (
        product_id, warehouse_id, quantity_change, reason, reference_type, reference_id
    )
    SELECT il.product_id, il.warehouse_id, -il.current_stock,
           v_reason, 'warehouse_consolidation', v_gye::text
    FROM public.inventory_levels il
    WHERE il.warehouse_id <> v_gye
      AND il.current_stock <> 0;

    GET DIAGNOSTICS v_movidos = ROW_COUNT;

    -- 2. Entrada a Guayaquil por la misma cantidad.
    INSERT INTO public.inventory_logs (
        product_id, warehouse_id, quantity_change, reason, reference_type, reference_id
    )
    SELECT il.product_id, v_gye, SUM(il.current_stock),
           v_reason, 'warehouse_consolidation', v_gye::text
    FROM public.inventory_levels il
    WHERE il.warehouse_id <> v_gye
      AND il.current_stock <> 0
    GROUP BY il.product_id;

    -- 3. Guayaquil se queda con el total de todas las bodegas. Los productos
    --    sin ninguna fila entran con 0: lo que importa es que existan ahi.
    INSERT INTO public.inventory_levels (product_id, warehouse_id, current_stock, last_updated)
    SELECT p.id, v_gye, COALESCE(tot.total, 0), timezone('utc'::text, now())
    FROM public.products p
    LEFT JOIN (
        SELECT product_id, SUM(current_stock) AS total
        FROM public.inventory_levels
        GROUP BY product_id
    ) tot ON tot.product_id = p.id
    ON CONFLICT (product_id, warehouse_id) DO UPDATE
        SET current_stock = EXCLUDED.current_stock,
            last_updated = EXCLUDED.last_updated;

    GET DIAGNOSTICS v_productos = ROW_COUNT;

    -- 4. Las demas bodegas quedan en 0.
    UPDATE public.inventory_levels
    SET current_stock = 0,
        last_updated = timezone('utc'::text, now())
    WHERE warehouse_id <> v_gye
      AND current_stock <> 0;

    RAISE NOTICE 'Guayaquil = bodega %. Productos con fila en Guayaquil: %. Filas de otras bodegas consolidadas: %.',
        v_gye, v_productos, v_movidos;
END $$;
