-- Migration: Update POS RPC for Omnichannel Attribution
-- Timestamp: 20260221223000

DROP TYPE IF EXISTS pos_item_input CASCADE;
CREATE TYPE pos_item_input AS (
    product_id INTEGER,
    warehouse_id INTEGER,
    quantity NUMERIC,
    unit_price NUMERIC,
    unit_cost NUMERIC
);

CREATE OR REPLACE FUNCTION process_pos_sale(
    p_customer_id INTEGER,
    p_payment_account_id INTEGER,
    p_shipping_cost NUMERIC,
    p_items pos_item_input[],
    p_closer_id UUID DEFAULT NULL,
    p_promo_code TEXT DEFAULT NULL,
    p_shipping_address TEXT DEFAULT 'POS Walk-in'
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
    v_revenue_account_id INTEGER;
    v_transaction_id INTEGER;
BEGIN
    -- 1. Calculate totals and verify stock
    FOREACH v_item IN ARRAY p_items
    LOOP
        -- Verify sufficient stock
        SELECT current_stock INTO v_current_stock
        FROM inventory_levels
        WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id
        FOR UPDATE; -- Lock row to prevent race conditions

        IF NOT FOUND OR v_current_stock < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto ID % en bodega %', v_item.product_id, v_item.warehouse_id;
        END IF;

        v_total_amount := v_total_amount + (v_item.quantity * v_item.unit_price);
        v_total_cost := v_total_cost + (v_item.quantity * v_item.unit_cost);
    END LOOP;

    v_total_amount := v_total_amount + p_shipping_cost;

    -- 2. Create the Order (Using pipeline strict statuses)
    INSERT INTO orders (
        customer_id, 
        closer_id, 
        promo_code, 
        status, 
        total_amount, 
        shipping_cost, 
        shipping_address
    )
    VALUES (
        p_customer_id, 
        p_closer_id, 
        p_promo_code, 
        'completed', -- Walk-in POS auto-completes
        v_total_amount, 
        p_shipping_cost,
        p_shipping_address
    )
    RETURNING id INTO v_order_id;

    -- 3. Process each item (Update Stock, Insert Order Items, Log Inventory)
    FOREACH v_item IN ARRAY p_items
    LOOP
        -- Deduct Stock
        UPDATE inventory_levels
        SET current_stock = current_stock - v_item.quantity
        WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id;

        -- Insert Order Item with unit_cost for Gross Profit calculation
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost)
        VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.unit_cost);

        -- Insert Inventory Log (Sale)
        INSERT INTO inventory_logs (
            product_id, 
            warehouse_id, 
            quantity_change, 
            reason, 
            transaction_type, 
            reference_id
        )
        VALUES (
            v_item.product_id, 
            v_item.warehouse_id, 
            -v_item.quantity, 
            'Venta POS (Orden #' || v_order_id || ')', 
            'sale', 
            v_order_id::TEXT
        );
    END LOOP;

    -- 4. Financial Transaction
    SELECT id INTO v_revenue_account_id
    FROM accounts 
    WHERE category = 'income' AND name ILIKE '%ventas%'
    LIMIT 1;

    IF FOUND THEN
        INSERT INTO transactions (description, transaction_date)
        VALUES ('Venta POS Orden #' || v_order_id, CURRENT_DATE)
        RETURNING id INTO v_transaction_id;

        -- Debit Payment Account (Increase Asset)
        INSERT INTO transaction_entries (transaction_id, account_id, amount, is_debit)
        VALUES (v_transaction_id, p_payment_account_id, v_total_amount, true);

        -- Credit Revenue Account (Increase Income)
        INSERT INTO transaction_entries (transaction_id, account_id, amount, is_debit)
        VALUES (v_transaction_id, v_revenue_account_id, v_total_amount, false);
    END IF;

    -- 5. Return Success
    RETURN jsonb_build_object(
        'success', true, 
        'order_id', v_order_id, 
        'total_amount', v_total_amount
    );
END;
$$;

-- Migration: Save POS Draft RPC
CREATE OR REPLACE FUNCTION save_draft_order(
    p_customer_id INTEGER,
    p_shipping_cost NUMERIC,
    p_items pos_item_input[],
    p_closer_id UUID DEFAULT NULL,
    p_promo_code TEXT DEFAULT NULL,
    p_draft_id INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id INTEGER;
    v_total_amount NUMERIC := 0;
    v_item pos_item_input;
BEGIN
    -- 1. Calculate totals (no stock deduction for drafts yet)
    FOREACH v_item IN ARRAY p_items
    LOOP
        v_total_amount := v_total_amount + (v_item.quantity * v_item.unit_price);
    END LOOP;

    v_total_amount := v_total_amount + p_shipping_cost;

    -- 2. Create or Update the Order Draft
    IF p_draft_id IS NOT NULL THEN
        -- Verify it's still a draft
        IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_draft_id AND status = 'draft') THEN
            RAISE EXCEPTION 'This order cannot be edited because it is no longer a draft.';
        END IF;

        UPDATE orders SET
            customer_id = p_customer_id,
            closer_id = p_closer_id,
            promo_code = p_promo_code,
            total_amount = v_total_amount,
            shipping_cost = p_shipping_cost
        WHERE id = p_draft_id
        RETURNING id INTO v_order_id;
        
        -- Delete old items to replace them
        DELETE FROM order_items WHERE order_id = v_order_id;
    ELSE
        INSERT INTO orders (
            customer_id, 
            closer_id, 
            promo_code, 
            status, 
            total_amount, 
            shipping_cost
        )
        VALUES (
            p_customer_id, 
            p_closer_id, 
            p_promo_code, 
            'draft',
            v_total_amount, 
            p_shipping_cost
        )
        RETURNING id INTO v_order_id;
    END IF;

    -- 3. Insert new Order Items
    FOREACH v_item IN ARRAY p_items
    LOOP
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost)
        VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.unit_cost);
    END LOOP;

    -- 4. Return Success
    RETURN jsonb_build_object(
        'success', true, 
        'order_id', v_order_id, 
        'total_amount', v_total_amount
    );
END;
$$;
