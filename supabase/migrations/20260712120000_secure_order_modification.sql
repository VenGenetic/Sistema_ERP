-- Migration: Secure Completed Order Modification and Cancellation (Dar de Baja)
-- Description: Adds modify_completed_sale and cancel_completed_sale RPC functions.
-- Timestamp: 20260712120000

CREATE OR REPLACE FUNCTION modify_completed_sale(
    p_order_id INTEGER,
    p_items pos_item_input[],
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to update tables and bypass RLS
AS $$
DECLARE
    v_order_status TEXT;
    v_order_date DATE;
    v_till_status TEXT;
    v_old_total NUMERIC;
    v_new_total NUMERIC := 0;
    v_old_total_cost NUMERIC := 0;
    v_new_total_cost NUMERIC := 0;
    v_item pos_item_input;
    v_current_item RECORD;
    v_diff_qty NUMERIC;
    v_current_stock NUMERIC;
    v_product_cost NUMERIC;
    v_product_price NUMERIC;
    v_vat_percent NUMERIC;
    v_transaction_id INTEGER;
    v_diff_amount NUMERIC;
    v_account_cash INTEGER;
    v_account_sales INTEGER;
    v_user_email TEXT;
    v_closer_id UUID;
    
    -- Commission variables
    v_old_commission NUMERIC := 0;
    v_new_commission NUMERIC := 0;
    v_comm_diff NUMERIC := 0;
    v_margin NUMERIC := 0;
BEGIN
    -- 1. Check authentication
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado.';
    END IF;

    SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;

    -- 2. Fetch order data and verify status
    SELECT status::text, total_amount, created_at::DATE, closer_id 
    INTO v_order_status, v_old_total, v_order_date, v_closer_id
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden #% no encontrada.', p_order_id;
    END IF;

    IF v_order_status IS DISTINCT FROM 'Entregado' THEN
        RAISE EXCEPTION 'Solo se pueden modificar pedidos con estado "Entregado".';
    END IF;

    -- 3. Safety Check: Verify that the till for the order's date is still OPEN
    SELECT status INTO v_till_status
    FROM public.daily_tills
    WHERE date = v_order_date;

    IF FOUND AND v_till_status = 'closed' THEN
        RAISE EXCEPTION 'No se puede modificar una venta de una fecha con caja cerrada (%). Abra la caja primero.', v_order_date;
    END IF;

    -- Calculate old total cost from original order items
    SELECT COALESCE(SUM(quantity * unit_cost), 0) INTO v_old_total_cost
    FROM public.order_items
    WHERE order_id = p_order_id;

    -- 4. Calculate new totals and adjust stock differentials
    FOREACH v_item IN ARRAY p_items
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'La cantidad debe ser mayor a 0.';
        END IF;

        SELECT cost_without_vat, COALESCE(vat_percentage, 0), price
        INTO v_product_cost, v_vat_percent, v_product_price
        FROM public.products
        WHERE id = v_item.product_id;

        -- Compare new quantity with old quantity for this product in this order
        SELECT COALESCE(quantity, 0) INTO v_diff_qty
        FROM public.order_items
        WHERE order_id = p_order_id AND product_id = v_item.product_id;

        v_diff_qty := v_item.quantity - v_diff_qty;

        IF v_diff_qty > 0 THEN
            -- Decrease stock
            IF v_item.warehouse_id != 0 THEN
                SELECT current_stock INTO v_current_stock
                FROM public.inventory_levels
                WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id
                FOR UPDATE;

                IF NOT FOUND OR v_current_stock < v_diff_qty THEN
                    RAISE EXCEPTION 'Stock insuficiente para el producto ID % en bodega % para el ajuste.', v_item.product_id, v_item.warehouse_id;
                END IF;

                UPDATE public.inventory_levels
                SET current_stock = current_stock - v_diff_qty,
                    last_updated = now()
                WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id;
            END IF;

            -- Log stock decrement
            INSERT INTO public.inventory_logs (
                product_id, warehouse_id, quantity_change, reason, reference_type, reference_id, user_id, created_at
            )
            VALUES (
                v_item.product_id, v_item.warehouse_id, -v_diff_qty, 
                'Ajuste incremento de venta (Orden #' || p_order_id || ')', 'sale', p_order_id::text, p_user_id, now()
            );
        ELSIF v_diff_qty < 0 THEN
            -- Increase stock (refund items to warehouse)
            IF v_item.warehouse_id != 0 THEN
                UPDATE public.inventory_levels
                SET current_stock = current_stock - v_diff_qty, -- v_diff_qty is negative, so this adds stock
                    last_updated = now()
                WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id;
            END IF;

            -- Log stock increment
            INSERT INTO public.inventory_logs (
                product_id, warehouse_id, quantity_change, reason, reference_type, reference_id, user_id, created_at
            )
            VALUES (
                v_item.product_id, v_item.warehouse_id, -v_diff_qty, 
                'Ajuste decremento de venta (Orden #' || p_order_id || ')', 'sale', p_order_id::text, p_user_id, now()
            );
        END IF;

        v_new_total := v_new_total + (v_item.quantity * v_item.unit_price);
        v_new_total_cost := v_new_total_cost + (v_item.quantity * v_item.unit_cost);
    END LOOP;

    -- Return stock for deleted items
    FOR v_current_item IN
        SELECT product_id, quantity, unit_cost
        FROM public.order_items
        WHERE order_id = p_order_id
          AND product_id NOT IN (SELECT product_id FROM unnest(p_items))
    LOOP
        -- Re-add stock
        UPDATE public.inventory_levels
        SET current_stock = current_stock + v_current_item.quantity,
            last_updated = now()
        WHERE product_id = v_current_item.product_id AND warehouse_id = (SELECT warehouse_id FROM public.orders WHERE id = p_order_id LIMIT 1);

        -- Log stock increment
        INSERT INTO public.inventory_logs (
            product_id, warehouse_id, quantity_change, reason, reference_type, reference_id, user_id, created_at
        )
        VALUES (
            v_current_item.product_id, (SELECT warehouse_id FROM public.orders WHERE id = p_order_id LIMIT 1), v_current_item.quantity, 
            'Ajuste eliminación ítem de venta (Orden #' || p_order_id || ')', 'sale', p_order_id::text, p_user_id, now()
        );
    END LOOP;

    -- Add shipping cost to new total
    v_new_total := v_new_total + COALESCE((SELECT shipping_cost FROM public.orders WHERE id = p_order_id), 0);

    -- 5. Calculate accounting differential and write compensatory entry
    v_diff_amount := ROUND(v_new_total - v_old_total, 2);

    IF v_diff_amount != 0 THEN
        -- Get cash payment account or default to shop cash account (24)
        SELECT payment_account_id INTO v_account_cash FROM public.orders WHERE id = p_order_id;
        IF v_account_cash IS NULL THEN
            SELECT id INTO v_account_cash FROM public.accounts WHERE code = '1-1004' LIMIT 1;
            IF v_account_cash IS NULL THEN
                v_account_cash := 24; -- Default fallback
            END IF;
        END IF;

        SELECT id INTO v_account_sales FROM public.accounts WHERE code = '4001' LIMIT 1;

        -- Create adjustment transaction
        INSERT INTO public.transactions (order_id, reference_type, description, created_at)
        VALUES (p_order_id, 'sale_adjustment', 'Ajuste de venta (Orden #' || p_order_id || ') por ' || COALESCE(v_user_email, 'Usuario'), now())
        RETURNING id INTO v_transaction_id;

        -- If v_diff_amount > 0: Debit Cash, Credit Sales
        -- If v_diff_amount < 0: Debit Sales, Credit Cash
        IF v_diff_amount > 0 THEN
            INSERT INTO public.transaction_lines (transaction_id, account_id, debit, credit) VALUES
            (v_transaction_id, v_account_cash, v_diff_amount, 0),
            (v_transaction_id, v_account_sales, 0, v_diff_amount);
        ELSE
            INSERT INTO public.transaction_lines (transaction_id, account_id, debit, credit) VALUES
            (v_transaction_id, v_account_sales, ABS(v_diff_amount), 0),
            (v_transaction_id, v_account_cash, 0, ABS(v_diff_amount));
        END IF;
    END IF;

    -- 6. Recalculate and Adjust Commissions
    -- Calculate net total commission already issued (credits - clawbacks)
    SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) INTO v_old_commission
    FROM public.commission_ledger
    WHERE order_id = p_order_id;

    -- Calculate new commission based on new margin
    v_margin := v_new_total - v_new_total_cost;
    IF v_margin > 0 THEN
        v_new_commission := ROUND(v_margin * 0.10, 2);
    ELSE
        v_new_commission := 0;
    END IF;

    v_comm_diff := v_new_commission - v_old_commission;

    IF v_comm_diff > 0 THEN
        -- Add commission credit
        INSERT INTO public.commission_ledger (sales_user_id, order_id, amount, type, status, created_at)
        VALUES (v_closer_id, p_order_id, v_comm_diff, 'credit', 'pending', now());
    ELSIF v_comm_diff < 0 THEN
        -- Add commission clawback
        INSERT INTO public.commission_ledger (sales_user_id, order_id, amount, type, status, created_at)
        VALUES (v_closer_id, p_order_id, ABS(v_comm_diff), 'clawback', 'pending', now());
    END IF;

    -- 7. Log system event for audit trail
    INSERT INTO public.system_events (event_type, status, payload, created_at)
    VALUES (
        'order_edit', 
        'success', 
        jsonb_build_object(
            'order_id', p_order_id,
            'edited_by', p_user_id,
            'user_email', v_user_email,
            'old_total', v_old_total,
            'new_total', v_new_total,
            'difference', v_diff_amount,
            'old_commission', v_old_commission,
            'new_commission', v_new_commission,
            'commission_diff', v_comm_diff,
            'edited_at', now()
        ),
        now()
    );

    -- 8. Update database tables
    UPDATE public.orders
    SET total_amount = v_new_total,
        status_updated_at = now(),
        status_updated_by = p_user_id
    WHERE id = p_order_id;

    DELETE FROM public.order_items WHERE order_id = p_order_id;

    FOREACH v_item IN ARRAY p_items
    LOOP
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, unit_cost)
        VALUES (p_order_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.unit_cost);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'old_total', v_old_total,
        'new_total', v_new_total,
        'difference', v_diff_amount,
        'commission_adjustment', v_comm_diff
    );
END;
$$;


CREATE OR REPLACE FUNCTION cancel_completed_sale(
    p_order_id INTEGER,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_status TEXT;
    v_order_date DATE;
    v_till_status TEXT;
    v_total_amount NUMERIC;
    v_shipping_cost NUMERIC;
    v_current_item RECORD;
    v_transaction_id INTEGER;
    v_account_cash INTEGER;
    v_account_sales INTEGER;
    v_account_shipping INTEGER;
    v_user_email TEXT;
BEGIN
    -- 1. Check authentication
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado.';
    END IF;

    SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;

    -- 2. Fetch order data and verify status
    SELECT status::text, total_amount, shipping_cost, created_at::DATE
    INTO v_order_status, v_total_amount, v_shipping_cost, v_order_date
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden #% no encontrada.', p_order_id;
    END IF;

    IF v_order_status IS DISTINCT FROM 'Entregado' THEN
        RAISE EXCEPTION 'Solo se pueden dar de baja pedidos con estado "Entregado".';
    END IF;

    -- 3. Safety Check: Verify that the till for the order's date is still OPEN
    SELECT status INTO v_till_status
    FROM public.daily_tills
    WHERE date = v_order_date;

    IF FOUND AND v_till_status = 'closed' THEN
        RAISE EXCEPTION 'No se puede dar de baja una venta de una fecha con caja cerrada (%). Abra la caja primero.', v_order_date;
    END IF;

    -- 4. Reintegrate all items in order_items back to stock
    FOR v_current_item IN
        SELECT product_id, quantity, unit_cost
        FROM public.order_items
        WHERE order_id = p_order_id
    LOOP
        -- Re-add stock
        UPDATE public.inventory_levels
        SET current_stock = current_stock + v_current_item.quantity,
            last_updated = now()
        WHERE product_id = v_current_item.product_id AND warehouse_id = (SELECT warehouse_id FROM public.orders WHERE id = p_order_id LIMIT 1);

        -- Log stock increment
        INSERT INTO public.inventory_logs (
            product_id, warehouse_id, quantity_change, reason, reference_type, reference_id, user_id, created_at
        )
        VALUES (
            v_current_item.product_id, (SELECT warehouse_id FROM public.orders WHERE id = p_order_id LIMIT 1), v_current_item.quantity, 
            'Cancelación/Baja de venta (Orden #' || p_order_id || ')', 'sale', p_order_id::text, p_user_id, now()
        );
    END LOOP;

    -- 5. Create accounting reversal transaction
    -- Get cash payment account or default
    SELECT payment_account_id INTO v_account_cash FROM public.orders WHERE id = p_order_id;
    IF v_account_cash IS NULL THEN
        SELECT id INTO v_account_cash FROM public.accounts WHERE code = '1-1004' LIMIT 1;
        IF v_account_cash IS NULL THEN
            v_account_cash := 24; -- Default fallback
        END IF;
    END IF;

    SELECT id INTO v_account_sales FROM public.accounts WHERE code = '4001' LIMIT 1;
    SELECT id INTO v_account_shipping FROM public.accounts WHERE code = '4002' LIMIT 1;

    -- Create reversal transaction
    INSERT INTO public.transactions (order_id, reference_type, description, created_at)
    VALUES (p_order_id, 'sale_reversal', 'Baja/Cancelación de venta (Orden #' || p_order_id || ') por ' || COALESCE(v_user_email, 'Usuario'), now())
    RETURNING id INTO v_transaction_id;

    -- Debit Sales (anulando ingreso) & Debit Shipping (anulando cargo)
    -- Credit Cash (anulando entrada de caja)
    IF v_total_amount > 0 THEN
        IF v_shipping_cost > 0 AND v_account_shipping IS NOT NULL THEN
            INSERT INTO public.transaction_lines (transaction_id, account_id, debit, credit) VALUES
            (v_transaction_id, v_account_sales, ROUND(v_total_amount - v_shipping_cost, 2), 0),
            (v_transaction_id, v_account_shipping, v_shipping_cost, 0),
            (v_transaction_id, v_account_cash, 0, v_total_amount);
        ELSE
            INSERT INTO public.transaction_lines (transaction_id, account_id, debit, credit) VALUES
            (v_transaction_id, v_account_sales, v_total_amount, 0),
            (v_transaction_id, v_account_cash, 0, v_total_amount);
        END IF;
    END IF;

    -- 6. Log system event for audit trail
    INSERT INTO public.system_events (event_type, status, payload, created_at)
    VALUES (
        'order_cancel', 
        'success', 
        jsonb_build_object(
            'order_id', p_order_id,
            'cancelled_by', p_user_id,
            'user_email', v_user_email,
            'total_amount', v_total_amount,
            'cancelled_at', now()
        ),
        now()
    );

    -- 7. Update order status to Cancelado
    -- The trigger process_order_commission will automatically clawback the commission
    UPDATE public.orders
    SET status = 'Cancelado'::order_status_enum,
        status_updated_at = now(),
        status_updated_by = p_user_id
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'total_amount_reversed', v_total_amount
    );
END;
$$;
