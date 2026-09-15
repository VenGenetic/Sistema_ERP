-- SRS-style rotation intervals for Modo Inventario.
--
-- Replaces the free-form interval_value/interval_unit (any number, any unit,
-- editable directly per group with no bounds) with a bounded system: each
-- group gets a rotation_class (Alta/Media/Baja), which gives interval_days a
-- floor and ceiling the algorithm can never cross. See utils/rotationClass.ts
-- for the bounds table and the frontend's suggested-interval math — the class
-- bounds are mirrored below in apply_inventory_group's CASE statement so the
-- guardrail holds server-side regardless of what the client sends; the two
-- must move together, the same way orderStateMachine.ts mirrors its RPC.

ALTER TABLE public.inventory_groups
    ADD COLUMN rotation_class TEXT NOT NULL DEFAULT 'medium'
        CHECK (rotation_class IN ('high', 'medium', 'low')),
    ADD COLUMN interval_days INT,
    ADD COLUMN last_accuracy_score NUMERIC;

-- Backfill: no historical data tells us a class, so every existing group
-- becomes 'medium' (its default above) and keeps as much of its old
-- free-form interval as fits inside medium's 30-90 day range. A group with
-- no interval configured (0 or null) lands on the medium midpoint (60)
-- instead of being clamped up from 0.
UPDATE public.inventory_groups
SET interval_days = LEAST(90, GREATEST(30, COALESCE(
    CASE interval_unit
        WHEN 'months' THEN NULLIF(interval_value, 0) * 30
        WHEN 'weeks' THEN NULLIF(interval_value, 0) * 7
        ELSE NULLIF(interval_value, 0)
    END,
    60
)));

ALTER TABLE public.inventory_groups
    ALTER COLUMN interval_days SET NOT NULL,
    ALTER COLUMN interval_days SET DEFAULT 60;

ALTER TABLE public.inventory_groups
    DROP COLUMN interval_value,
    DROP COLUMN interval_unit;

-- apply_inventory_group gains a second parameter (p_next_interval_days) and
-- can no longer be replaced in place with CREATE OR REPLACE because the
-- parameter list changes — drop and recreate instead.
DROP FUNCTION IF EXISTS public.apply_inventory_group(UUID);

CREATE OR REPLACE FUNCTION public.apply_inventory_group(
    p_group_id UUID,
    p_next_interval_days INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_warehouse_id INT;
    v_group_name TEXT;
    v_rotation_class TEXT;
    v_current_interval INT;
    v_class_min INT;
    v_class_max INT;
    v_item RECORD;
    v_current_stock NUMERIC;
    v_diff NUMERIC;
    v_items_processed INT := 0;
    v_items_changed INT := 0;
    v_items_matched INT;
    v_accuracy NUMERIC;
    v_final_interval INT;
BEGIN
    -- Lock the group itself so two "Finalizar y Aplicar" calls on the same
    -- group can't run concurrently.
    SELECT warehouse_id, name, rotation_class, interval_days
    INTO v_warehouse_id, v_group_name, v_rotation_class, v_current_interval
    FROM public.inventory_groups
    WHERE id = p_group_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Grupo de inventario % no encontrado', p_group_id;
    END IF;

    IF v_warehouse_id IS NULL THEN
        RAISE EXCEPTION 'El grupo % no tiene una bodega asignada', p_group_id;
    END IF;

    -- Guardrails mirrored from utils/rotationClass.ts — must move together.
    CASE v_rotation_class
        WHEN 'high' THEN v_class_min := 7;  v_class_max := 30;
        WHEN 'low'  THEN v_class_min := 90; v_class_max := 365;
        ELSE                 v_class_min := 30; v_class_max := 90; -- 'medium'
    END CASE;

    FOR v_item IN
        SELECT product_id, counted_stock
        FROM public.inventory_group_items
        WHERE group_id = p_group_id
    LOOP
        v_items_processed := v_items_processed + 1;

        -- Pessimistic lock, scoped to this group's warehouse specifically.
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
    -- stock writes above.
    UPDATE public.inventory_group_items
    SET counted_stock = 0
    WHERE group_id = p_group_id;

    -- Accuracy = % of items that matched the database exactly (Cuadrados).
    -- Computed here, from this transaction's own counters, so it can't be
    -- spoofed by whatever the client previewed in the pre-confirm modal.
    v_items_matched := v_items_processed - v_items_changed;
    v_accuracy := CASE WHEN v_items_processed > 0
        THEN round(100.0 * v_items_matched / v_items_processed, 2)
        ELSE NULL
    END;

    -- The manager's chosen interval (accept suggestion / keep / forced
    -- value) always wins over whatever the client computed, but never
    -- outside the class's floor/ceiling — the one guardrail this function
    -- enforces regardless of what p_next_interval_days is.
    v_final_interval := GREATEST(v_class_min, LEAST(v_class_max,
        COALESCE(p_next_interval_days, v_current_interval)
    ));

    UPDATE public.inventory_groups
    SET last_counted_at = timezone('utc'::text, now()),
        session_started_at = NULL,
        interval_days = v_final_interval,
        last_accuracy_score = v_accuracy
    WHERE id = p_group_id;

    RETURN jsonb_build_object(
        'group_id', p_group_id,
        'items_processed', v_items_processed,
        'items_changed', v_items_changed,
        'accuracy_score', v_accuracy,
        'interval_days_applied', v_final_interval
    );
END;
$$;
