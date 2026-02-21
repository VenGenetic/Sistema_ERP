-- Migration: POS Checkout RPC
-- Description: Creates an atomic function to process sales from the Point of Sale module.

-- Create a type for the items array to pass into the RPC
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
    p_items pos_item_input[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Ensures the RPC runs with elevated privileges to update inventory
AS $$
DECLARE
    v_order_id INTEGER;
    v_total_amount NUMERIC := 0;
    v_total_cost NUMERIC := 0;
    v_item pos_item_input;
    v_current_stock NUMERIC;
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

    -- 2. Create the Order
    INSERT INTO orders (customer_id, status, total_amount, shipping_address)
    VALUES (p_customer_id, 'approved', v_total_amount, 'POS Sale')
    RETURNING id INTO v_order_id;

    -- 3. Process each item (Update Stock, Insert Order Items, Log Inventory)
    FOREACH v_item IN ARRAY p_items
    LOOP
        -- Deduct Stock
        UPDATE inventory_levels
        SET current_stock = current_stock - v_item.quantity
        WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id;

        -- Insert Order Item
        INSERT INTO order_items (order_id, product_id, quantity, unit_price)
        VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.unit_price);

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
    -- Assuming double-entry logic: Debit Asset (Payment Account), Credit Revenue (Ventas)
    -- We need the "Ventas" account ID. 
    -- We will try to find an income account named "Ventas", if not, fallback to a general income account
    DECLARE
        v_revenue_account_id INTEGER;
        v_transaction_id INTEGER;
    BEGIN
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
    END;

    -- 5. Return Success
    RETURN jsonb_build_object(
        'success', true, 
        'order_id', v_order_id, 
        'total_amount', v_total_amount
    );
END;
$$;
