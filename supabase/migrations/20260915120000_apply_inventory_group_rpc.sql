-- Phase 1 fix: move "Finalizar y Aplicar" (Modo Inventario) server-side.
-- Previously InventorySession.tsx applied a group's count by reading
-- inventory_levels with .eq('product_id', ...).limit(1) — no warehouse_id
-- filter, no row lock — then writing the update and the inventory_logs row
-- as two separate client-side calls. On a product stocked in more than one
-- warehouse this could silently write the wrong warehouse's stock, and with
-- no FOR UPDATE lock it could race against a concurrent POS sale
-- (process_pos_sale already locks inventory_levels FOR UPDATE).
--
-- This RPC applies an entire inventory_group atomically: locks the group,
-- locks each item's (product_id, group.warehouse_id) row before reading it,
-- writes inventory_levels + inventory_logs together, and resets the group
-- for its next cycle — all in one transaction.

CREATE OR REPLACE FUNCTION public.apply_inventory_group(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_warehouse_id INT;
    v_group_name TEXT;
    v_item RECORD;
    v_current_stock NUMERIC;
    v_diff NUMERIC;
    v_items_processed INT := 0;
    v_items_changed INT := 0;
BEGIN
    -- Lock the group itself so two "Finalizar y Aplicar" calls on the same
    -- group can't run concurrently.
    SELECT warehouse_id, name INTO v_warehouse_id, v_group_name
    FROM public.inventory_groups
    WHERE id = p_group_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Grupo de inventario % no encontrado', p_group_id;
    END IF;

    IF v_warehouse_id IS NULL THEN
        RAISE EXCEPTION 'El grupo % no tiene una bodega asignada', p_group_id;
    END IF;

    FOR v_item IN
        SELECT product_id, counted_stock
        FROM public.inventory_group_items
        WHERE group_id = p_group_id
    LOOP
        v_items_processed := v_items_processed + 1;

        -- Pessimistic lock, scoped to this group's warehouse specifically —
        -- this is the line that was missing a WHERE warehouse_id = ... before.
        SELECT current_stock INTO v_current_stock
        FROM public.inventory_levels
        WHERE product_id = v_item.product_id AND warehouse_id = v_warehouse_id
        FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO public.inventory_levels (product_id, warehouse_id, current_stock)
            VALUES (v_item.product_id, v_warehouse_id, 0)
            RETURNING current_stock INTO v_current_stock;
        END IF;

        v_diff := v_item.counted_stock - v_current_stock;

        IF v_diff <> 0 THEN
            UPDATE public.inventory_levels
            SET current_stock = v_item.counted_stock,
                last_updated = now()
            WHERE product_id = v_item.product_id AND warehouse_id = v_warehouse_id;

            INSERT INTO public.inventory_logs (
                product_id, warehouse_id, quantity_change, reason,
                reference_type, reference_id, user_id
            ) VALUES (
                v_item.product_id, v_warehouse_id, v_diff,
                'Ajuste Modo Inventario - Grupo: ' || v_group_name,
                'inventory_mode', p_group_id::text, auth.uid()
            );

            v_items_changed := v_items_changed + 1;
        END IF;
    END LOOP;

    -- Reset the group for its next cycle, in the same transaction as the
    -- stock writes above — this used to be two separate client-side calls
    -- that could leave the group half-applied if one of them failed.
    UPDATE public.inventory_group_items
    SET counted_stock = 0
    WHERE group_id = p_group_id;

    UPDATE public.inventory_groups
    SET last_counted_at = timezone('utc'::text, now()),
        session_started_at = NULL
    WHERE id = p_group_id;

    RETURN jsonb_build_object(
        'group_id', p_group_id,
        'items_processed', v_items_processed,
        'items_changed', v_items_changed
    );
END;
$$;
