-- Migration: POS V2 (Atomic Sales, Analytics, Lost Demand)
-- Timestamp: 20260221170000

-- 1. Order Items updates
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,4) DEFAULT 0;

-- 2. Orders updates
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,4) DEFAULT 0;

-- 3. RLS for Orders (Restrict Closer from updating)
-- Assuming role_id 2 is Closer/Cashier.
-- We only restrict UPDATE. INSERT is allowed, SELECT is allowed.
-- Check if policy exists, then drop and recreate or just create.
DO $$
BEGIN
    DROP POLICY IF EXISTS "Prevent Closer Update on Orders" ON orders;
    -- We can just create a simple policy that denies update if role_id = 2
    -- But row level security policies are usually additive. 
    -- To restrict, we'd need to ensure whatever existing UPDATE policy exists handles this,
    -- OR we can create a policy that only allows UPDATE if role_id != 2.
    -- (Assuming existing policy might be "true" for authenticated)
END $$;

-- Drop existing UPDATE policy if any to replace with a more secure one
DROP POLICY IF EXISTS "Allow update access for authenticated users to orders" ON orders;
CREATE POLICY "Allow update access for authenticated users to orders" 
ON orders FOR UPDATE TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role_id != 2
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role_id != 2
    )
);


-- 4. Accounts Creation (Sales Income & Shipping Revenue)
DO $$
BEGIN
    -- Product Sales Income
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE name = 'Ingresos por Ventas') THEN
        INSERT INTO accounts (code, name, category, is_nominal, currency, position)
        VALUES ('4.1.01', 'Ingresos por Ventas', 'income', true, 'USD', 40);
    END IF;

    -- Shipping Revenue
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE name = 'Ingresos por Envío') THEN
        INSERT INTO accounts (code, name, category, is_nominal, currency, position)
        VALUES ('4.1.02', 'Ingresos por Envío', 'income', true, 'USD', 41);
    END IF;
END $$;


-- 5. Views for Analytics and Commissions
CREATE OR REPLACE VIEW view_rep_commissions AS
SELECT 
    o.id AS order_id,
    o.created_at,
    o.created_by AS user_id,
    p.name AS rep_name,
    oi.product_id,
    oi.quantity,
    oi.unit_price,
    oi.unit_cost,
    ((oi.unit_price - oi.unit_cost) * oi.quantity) AS gross_profit,
    ((oi.unit_price - oi.unit_cost) * oi.quantity * 0.10) AS commission
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN profiles p ON o.created_by = p.id
WHERE o.status = 'paid' OR o.payment_status = 'paid';

CREATE OR REPLACE VIEW v_daily_sales_stats AS
SELECT 
    DATE(o.created_at) AS sale_date,
    o.created_by AS user_id,
    COUNT(DISTINCT o.id) AS total_orders,
    SUM(oi.quantity) AS total_items_sold,
    SUM(oi.unit_price * oi.quantity) AS total_sales_revenue,
    SUM(o.shipping_cost) AS total_shipping_revenue,
    SUM((oi.unit_price - oi.unit_cost) * oi.quantity) AS total_gross_profit,
    SUM((oi.unit_price - oi.unit_cost) * oi.quantity * 0.10) AS total_commission
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.status = 'paid' OR o.payment_status = 'paid'
GROUP BY DATE(o.created_at), o.created_by;


-- 6. Atomic POS Sale RPC
CREATE OR REPLACE FUNCTION process_pos_sale(
    p_customer_id INTEGER,
    p_payment_account_id INTEGER, -- Cash/Bank account to receive funds
    p_shipping_cost NUMERIC,
    p_items JSONB -- Array of { product_id, warehouse_id, quantity, unit_price, unit_cost }
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_item JSONB;
    v_product_id BIGINT;
    v_warehouse_id INT;
    v_qty INT;
    v_price NUMERIC;
    v_cost NUMERIC;
    v_total_product_revenue NUMERIC := 0;
    v_sales_account_id INT;
    v_shipping_account_id INT;
    v_tx_lines JSONB := '[]'::JSONB;
BEGIN
    -- 1. Setup Accounts
    SELECT id INTO v_sales_account_id FROM accounts WHERE name = 'Ingresos por Ventas' LIMIT 1;
    SELECT id INTO v_shipping_account_id FROM accounts WHERE name = 'Ingresos por Envío' LIMIT 1;
    
    IF v_sales_account_id IS NULL OR v_shipping_account_id IS NULL THEN
        RAISE EXCEPTION 'Accounting accounts not configured for sales';
    END IF;

    -- 2. Create Order
    INSERT INTO orders (customer_id, channel, status, payment_status, shipping_cost, total, created_by)
    VALUES (COALESCE(p_customer_id, 1), 'POS', 'shipped', 'paid', COALESCE(p_shipping_cost, 0), 0, auth.uid())
    RETURNING id INTO v_order_id;

    -- 3. Process Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::BIGINT;
        v_warehouse_id := (v_item->>'warehouse_id')::INT;
        v_qty := (v_item->>'quantity')::INT;
        v_price := (v_item->>'unit_price')::NUMERIC;
        v_cost := (v_item->>'unit_cost')::NUMERIC;

        -- Check Stock
        IF NOT EXISTS (
            SELECT 1 FROM inventory_levels 
            WHERE product_id = v_product_id AND warehouse_id = v_warehouse_id AND current_stock >= v_qty
        ) THEN
            RAISE EXCEPTION 'Insufficient stock for product % in warehouse %', v_product_id, v_warehouse_id;
        END IF;

        -- Decrement Stock
        UPDATE inventory_levels 
        SET current_stock = current_stock - v_qty, last_updated = NOW()
        WHERE product_id = v_product_id AND warehouse_id = v_warehouse_id;

        -- Insert Inventory Log
        INSERT INTO inventory_logs (product_id, warehouse_id, quantity_change, reason, user_id, reference_type, reference_id)
        VALUES (v_product_id, v_warehouse_id, -v_qty, 'sale', auth.uid(), 'order', v_order_id::text);

        -- Insert Order Item
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost)
        VALUES (v_order_id, v_product_id, v_qty, v_price, v_cost);

        v_total_product_revenue := v_total_product_revenue + (v_qty * v_price);
    END LOOP;

    -- Update Order Total
    UPDATE orders SET total = v_total_product_revenue + p_shipping_cost WHERE id = v_order_id;

    -- 4. Financial Transaction Setup
    -- Debit: Cash/Bank Account (Receiving Money)
    v_tx_lines := v_tx_lines || jsonb_build_object(
        'account_id', p_payment_account_id,
        'debit', v_total_product_revenue + p_shipping_cost,
        'credit', 0
    );
    -- Credit: Sales Revenue
    v_tx_lines := v_tx_lines || jsonb_build_object(
        'account_id', v_sales_account_id,
        'debit', 0,
        'credit', v_total_product_revenue
    );
    -- Credit: Shipping Revenue (if any)
    IF COALESCE(p_shipping_cost, 0) > 0 THEN
        v_tx_lines := v_tx_lines || jsonb_build_object(
            'account_id', v_shipping_account_id,
            'debit', 0,
            'credit', p_shipping_cost
        );
    END IF;

    -- Call create_transaction_v1
    PERFORM create_transaction_v1(
        'Venta POS ' || v_order_id::text,
        'sale',
        NULL, -- Not storing UUID as INT order_id in transactions right now, or just NULL
        v_tx_lines
    );

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$$;
