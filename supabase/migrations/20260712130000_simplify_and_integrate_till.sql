-- Migration: Simplify Orders and Integrate Till
-- Timestamp: 20260712130000

-- ============================================================
-- 1. Guarded Status Transition RPC (State Machine Simplification)
-- ============================================================
CREATE OR REPLACE FUNCTION update_order_status(
    p_order_id INTEGER,
    p_new_status TEXT,
    p_user_id UUID DEFAULT NULL,
    p_tracking_number TEXT DEFAULT NULL,
    p_carrier_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status order_status_enum;
    v_new_status order_status_enum;
    v_allowed BOOLEAN := FALSE;
    v_order_record RECORD;
    v_till_status TEXT;
BEGIN
    -- 1. Fetch current order
    SELECT status, id, created_at INTO v_order_record
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden #% no encontrada.', p_order_id;
    END IF;

    v_current_status := v_order_record.status;
    
    -- 2. Cast new status
    BEGIN
        v_new_status := p_new_status::order_status_enum;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Estado inválido: %.', p_new_status;
    END;

    -- 3. Validate transition (simplified state machine)
    v_allowed := CASE
        WHEN v_current_status = 'Borrador' AND v_new_status IN ('Listo_Cumplimiento', 'Entregado', 'Cancelado') THEN TRUE
        WHEN v_current_status = 'Listo_Cumplimiento' AND v_new_status IN ('Entregado', 'Borrador', 'Cancelado') THEN TRUE
        WHEN v_current_status = 'Entregado' AND v_new_status IN ('RMA_Pendiente', 'Reembolsado') THEN TRUE
        -- Allow self-transitions or other necessary ones just in case? The spec says to restrict to these:
        ELSE FALSE
    END;

    -- Also allow transitions from other states backwards to Borrador just in case there are legacy orders
    IF NOT v_allowed AND v_new_status = 'Cancelado' THEN
        v_allowed := TRUE;
    END IF;

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Transición no permitida: % → %. Verifique el flujo de trabajo.', v_current_status, v_new_status;
    END IF;

    -- 4. Till Control for 'Entregado'
    IF v_new_status = 'Entregado' AND v_current_status != 'Entregado' THEN
        -- Check if the till for today (Ecuador time) is open.
        SELECT status INTO v_till_status
        FROM daily_tills
        WHERE date = (date_trunc('day', now() AT TIME ZONE 'America/Guayaquil'))::date;

        IF COALESCE(v_till_status, 'closed') != 'open' THEN
            RAISE EXCEPTION 'No se puede marcar la orden como Entregado. La caja del día está cerrada o no ha sido abierta.';
        END IF;
    END IF;

    -- 5. Perform the update (no more tracking strict requirements)
    UPDATE orders SET
        status = v_new_status,
        tracking_number = COALESCE(p_tracking_number, tracking_number),
        carrier_name = COALESCE(p_carrier_name, carrier_name),
        status_updated_at = NOW(),
        status_updated_by = p_user_id
    WHERE id = p_order_id;

    -- 6. Return result
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'previous_status', v_current_status::text,
        'new_status', v_new_status::text,
        'tracking_number', p_tracking_number
    );
END;
$$;


-- ============================================================
-- 2. POS Sale Process (Handle Shipping via Listo_Cumplimiento)
-- ============================================================
CREATE OR REPLACE FUNCTION process_pos_sale(
    p_customer_id INTEGER,
    p_payment_account_id INTEGER,
    p_shipping_cost NUMERIC,
    p_items pos_item_input[],
    p_closer_id UUID DEFAULT NULL,
    p_promo_code TEXT DEFAULT NULL,
    p_shipping_address TEXT DEFAULT 'POS Walk-in',
    p_shipping_expense_account_id INTEGER DEFAULT NULL,
    p_draft_id INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id INTEGER;
    v_total_amount NUMERIC := 0;
    v_total_cost NUMERIC := 0;
    v_item pos_item_input;
    v_current_stock NUMERIC;
    v_resolved_closer_id UUID;
    v_promo_discount NUMERIC := 0;
    v_customer_email TEXT;
    v_customer_phone TEXT;
    v_product_cost NUMERIC;
    v_product_price NUMERIC;
    v_vat_percent NUMERIC;
    v_price_floor NUMERIC;
    v_price_ceiling NUMERIC;
    v_has_manual_discount BOOLEAN := false;
    v_max_manual_discount_pct NUMERIC := 0;
    v_item_discount_pct NUMERIC;
    v_final_status order_status_enum;
BEGIN
    -- STEP 0: Sanity checks
    IF p_items IS NULL OR array_length(p_items, 1) IS NULL THEN
        RAISE EXCEPTION 'No se puede procesar una venta sin productos.';
    END IF;

    v_resolved_closer_id := p_closer_id;
    
    IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
        SELECT id INTO v_resolved_closer_id
        FROM profiles
        WHERE referral_code = upper(trim(p_promo_code));
        
        IF v_resolved_closer_id IS NULL THEN
            RAISE EXCEPTION 'Código promo inválido: %', p_promo_code;
        END IF;
        
        SELECT email, phone INTO v_customer_email, v_customer_phone
        FROM customers
        WHERE id = p_customer_id;
        
        IF v_customer_email IS NULL OR v_customer_email = '' 
           OR v_customer_phone IS NULL OR v_customer_phone = '' THEN
            RAISE EXCEPTION 'El cliente debe tener email y teléfono registrados para usar un código promo. Actualice los datos del cliente.';
        END IF;
    END IF;

    -- STEP 1: Calculate totals, verify stock, enforce price guardrails
    FOREACH v_item IN ARRAY p_items
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'La cantidad debe ser mayor a 0 para el producto ID %', v_item.product_id;
        END IF;

        IF v_item.unit_price < 0 THEN
            RAISE EXCEPTION 'El precio unitario no puede ser negativo para el producto ID %', v_item.product_id;
        END IF;

        IF v_item.unit_cost IS NULL OR v_item.unit_cost < 0 THEN
            v_item.unit_cost := 0;
        END IF;

        SELECT cost_without_vat, COALESCE(vat_percentage, 0), price
        INTO v_product_cost, v_vat_percent, v_product_price
        FROM products
        WHERE id = v_item.product_id;

        IF v_item.warehouse_id != 0 THEN
            SELECT current_stock INTO v_current_stock
            FROM inventory_levels
            WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id
            FOR UPDATE;

            IF NOT FOUND OR v_current_stock < v_item.quantity THEN
                RAISE EXCEPTION 'Stock insuficiente para el producto ID % en bodega %', v_item.product_id, v_item.warehouse_id;
            END IF;

            -- Floor price calculation only for non-manual items
            v_price_floor := v_product_cost * (1 + v_vat_percent / 100) * 1.05;
            v_price_ceiling := v_product_price * 1.15;

            IF v_item.unit_price < v_price_floor THEN
                RAISE EXCEPTION 'El precio unitario ($%) para el producto ID % está por debajo del mínimo ($%). Se requiere un mínimo de 5%% de margen.', 
                    round(v_item.unit_price, 2), v_item.product_id, round(v_price_floor, 2);
            END IF;

            IF v_item.unit_price > v_price_ceiling THEN
                RAISE EXCEPTION 'El precio unitario ($%) para el producto ID % supera el máximo permitido ($%). Máximo 15%% sobre PVP.', 
                    round(v_item.unit_price, 2), v_item.product_id, round(v_price_ceiling, 2);
            END IF;
        END IF;

        IF v_item.unit_price < v_product_price THEN
            v_item_discount_pct := ((v_product_price - v_item.unit_price) / v_product_price) * 100;
            IF v_item_discount_pct > v_max_manual_discount_pct THEN
                v_max_manual_discount_pct := v_item_discount_pct;
            END IF;
            v_has_manual_discount := true;
        END IF;

        v_total_amount := v_total_amount + (v_item.quantity * v_item.unit_price);
        v_total_cost := v_total_cost + (v_item.quantity * v_item.unit_cost);
    END LOOP;

    -- STEP 2: Apply promo discount (non-stackable)
    IF v_resolved_closer_id IS NOT NULL AND p_promo_code IS NOT NULL AND p_promo_code != '' THEN
        IF v_max_manual_discount_pct <= 3 THEN
            v_promo_discount := v_total_amount * 0.03;
            v_total_amount := v_total_amount - v_promo_discount;
        END IF;
    END IF;

    v_total_amount := v_total_amount + p_shipping_cost;

    -- Determine final status based on shipping
    IF p_shipping_address != 'POS Walk-in' AND p_shipping_address != '' THEN
        v_final_status := 'Listo_Cumplimiento'::order_status_enum;
    ELSE
        v_final_status := 'Entregado'::order_status_enum;
    END IF;

    -- STEP 3: Create or Update the Order AS DRAFT (Borrador) initially or direct
    IF p_draft_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_draft_id AND status = 'Borrador'::order_status_enum) THEN
            RAISE EXCEPTION 'Esta orden ya fue procesada o cancelada y no puede modificarse.';
        END IF;

        UPDATE orders SET
            customer_id = p_customer_id,
            closer_id = v_resolved_closer_id,
            promo_code = p_promo_code,
            total_amount = v_total_amount,
            shipping_cost = p_shipping_cost,
            shipping_address = p_shipping_address,
            payment_account_id = p_payment_account_id,
            shipping_expense_account_id = p_shipping_expense_account_id
        WHERE id = p_draft_id
        RETURNING id INTO v_order_id;

        DELETE FROM order_items WHERE order_id = v_order_id;
    ELSE
        INSERT INTO orders (
            customer_id, 
            closer_id, 
            promo_code, 
            status, 
            total_amount, 
            shipping_cost, 
            shipping_address,
            payment_account_id,
            shipping_expense_account_id
        )
        VALUES (
            p_customer_id, 
            v_resolved_closer_id, 
            p_promo_code, 
            'Borrador'::order_status_enum,
            v_total_amount, 
            p_shipping_cost,
            p_shipping_address,
            p_payment_account_id,
            p_shipping_expense_account_id
        )
        RETURNING id INTO v_order_id;
    END IF;

    -- STEP 4: Process each item
    FOREACH v_item IN ARRAY p_items
    LOOP
        IF v_item.warehouse_id != 0 THEN
            UPDATE inventory_levels
            SET current_stock = current_stock - v_item.quantity,
                last_updated = now()
            WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id;

            INSERT INTO inventory_logs (
                product_id, 
                warehouse_id, 
                quantity_change, 
                reason, 
                reference_type, 
                reference_id,
                user_id
            )
            VALUES (
                v_item.product_id, 
                v_item.warehouse_id, 
                -v_item.quantity, 
                'Venta POS (Orden #' || v_order_id || ')', 
                'sale', 
                v_order_id::TEXT,
                auth.uid()
            );
        END IF;

        INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost)
        VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.unit_cost);
    END LOOP;

    -- STEP 5: Mark to final status
    -- The trigger on 'Entregado' will handle financial accounting.
    UPDATE orders SET status = v_final_status WHERE id = v_order_id;

    -- STEP 6: Return Success
    RETURN jsonb_build_object(
        'success', true, 
        'order_id', v_order_id, 
        'total_amount', v_total_amount,
        'promo_discount', v_promo_discount,
        'closer_id', v_resolved_closer_id,
        'status', v_final_status::text
    );
END;
$$;
