-- Migration: Update POS RPC for Split Fulfillment and Advanced Accounting
-- Timestamp: 20260301010000

-- 1. Redefine pos_item_input with status support
DROP TYPE IF EXISTS pos_item_input CASCADE;
CREATE TYPE pos_item_input AS (
    product_id INTEGER,
    warehouse_id INTEGER,
    quantity NUMERIC,
    unit_price NUMERIC,
    unit_cost NUMERIC,
    status TEXT -- new field (in_stock, pending_sourcing, etc)
);

-- 2. Update process_pos_sale to handle split fulfillment logic
CREATE OR REPLACE FUNCTION process_pos_sale(
    p_customer_id INTEGER,
    p_payment_account_id INTEGER,
    p_shipping_cost NUMERIC,
    p_items pos_item_input[],
    p_closer_id UUID DEFAULT NULL,
    p_promo_code TEXT DEFAULT NULL,
    p_shipping_address TEXT DEFAULT 'POS Walk-in',
    p_shipping_expense_account_id INTEGER DEFAULT NULL
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
    v_price_floor NUMERIC;
    v_price_ceiling NUMERIC;
    v_has_manual_discount BOOLEAN := false;
    v_max_manual_discount_pct NUMERIC := 0;
    v_item_discount_pct NUMERIC;
    v_has_pending_items BOOLEAN := false;
BEGIN
    -- STEP 0: Resolve promo code → closer_id
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
            RAISE EXCEPTION 'El cliente debe tener email y teléfono registrados para usar un código promo.';
        END IF;
    END IF;

    -- STEP 1: Calculate totals, verify stock (only for in_stock items), enforce guardrails
    FOREACH v_item IN ARRAY p_items
    LOOP
        -- If item is NOT pending_sourcing, check stock
        IF v_item.status = 'in_stock' THEN
            SELECT current_stock INTO v_current_stock
            FROM inventory_levels
            WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id
            FOR UPDATE;

            IF NOT FOUND OR v_current_stock < v_item.quantity THEN
                RAISE EXCEPTION 'Stock insuficiente para el producto ID % en bodega %', v_item.product_id, v_item.warehouse_id;
            END IF;
        ELSE
            v_has_pending_items := true;
        END IF;

        SELECT cost_without_vat, COALESCE(vat_percentage, 0), price
        INTO v_product_cost, v_price_floor, v_product_price
        FROM products
        WHERE id = v_item.product_id;

        -- Guardrails (Costs might be 0 for new special items, skip if cost is 0 and it's draft)
        IF v_product_cost > 0 THEN
            v_price_floor := v_product_cost * (1 + v_price_floor / 100) * 1.05;
            IF v_item.unit_price < v_price_floor THEN
                RAISE EXCEPTION 'Precio por debajo del mínimo para producto ID %', v_item.product_id;
            END IF;
        END IF;

        IF v_item.unit_price > v_product_price * 1.15 THEN
            RAISE EXCEPTION 'Precio por encima del máximo para producto ID %', v_item.product_id;
        END IF;

        IF v_item.unit_price < v_product_price THEN
            v_item_discount_pct := ((v_product_price - v_item.unit_price) / v_product_price) * 100;
            IF v_item_discount_pct > v_max_manual_discount_pct THEN
                v_max_manual_discount_pct := v_item_discount_pct;
            END IF;
        END IF;

        v_total_amount := v_total_amount + (v_item.quantity * v_item.unit_price);
        v_total_cost := v_total_cost + (v_item.quantity * v_item.unit_cost);
    END LOOP;

    -- STEP 2: Promo discount
    IF v_resolved_closer_id IS NOT NULL AND p_promo_code IS NOT NULL AND p_promo_code != '' THEN
        IF v_max_manual_discount_pct <= 3 THEN
            v_promo_discount := v_total_amount * 0.03;
            v_total_amount := v_total_amount - v_promo_discount;
        END IF;
    END IF;

    v_total_amount := v_total_amount + p_shipping_cost;

    -- STEP 3: Create Order
    INSERT INTO orders (
        customer_id, closer_id, promo_code, status, 
        total_amount, shipping_cost, shipping_address,
        payment_account_id, shipping_expense_account_id
    )
    VALUES (
        p_customer_id, v_resolved_closer_id, p_promo_code, 
        'processing', -- Always processing initially if paid
        v_total_amount, p_shipping_cost, p_shipping_address,
        p_payment_account_id, p_shipping_expense_account_id
    )
    RETURNING id INTO v_order_id;

    -- STEP 4: Insert items and update stock
    FOREACH v_item IN ARRAY p_items
    LOOP
        IF v_item.status = 'in_stock' THEN
            UPDATE inventory_levels
            SET current_stock = current_stock - v_item.quantity
            WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id;

            INSERT INTO inventory_logs (product_id, warehouse_id, quantity_change, reason, transaction_type, reference_id)
            VALUES (v_item.product_id, v_item.warehouse_id, -v_item.quantity, 'Venta POS', 'sale', v_order_id::TEXT);
        END IF;

        INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost, status)
        VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.unit_cost, COALESCE(v_item.status, 'in_stock'));
    END LOOP;

    -- Final order status update (might be completed if everything was in_stock)
    IF NOT v_has_pending_items THEN
        -- If all items are in_stock, we might still want to mark as completed if it's already shipped?
        -- Actually, POS walk-in implies immediate pickup of in_stock items.
        -- We'll let the trigger handle status updates if we want, or manually update here.
        -- But wait, a POS sale should technically be 'completed' only when delivered.
        -- Let's stick to 'processing' and let the Warehouse view handle 'shipped' which makes it 'completed'.
        -- UNLESS it's a walk-in with ONLY in-stock items.
        UPDATE orders SET status = 'completed' WHERE id = v_order_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$$;

-- 3. Update financial trigger to handle Advances
CREATE OR REPLACE FUNCTION process_order_financial_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_gross_revenue NUMERIC := 0;
    v_gross_advance NUMERIC := 0;
    v_discount NUMERIC := 0;
    v_shipping NUMERIC := 0;
    v_net_total NUMERIC := 0;
    v_total_items_price NUMERIC := 0;
    
    v_account_cash INTEGER;
    v_account_sales INTEGER;
    v_account_advances INTEGER;
    v_account_shipping INTEGER;
    v_account_discount INTEGER;
    
    v_lines JSONB := '[]'::jsonb;
BEGIN
    IF EXISTS (SELECT 1 FROM transactions WHERE order_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    -- Calculate Revenue vs Advance
    SELECT 
        COALESCE(SUM(CASE WHEN status = 'in_stock' THEN quantity * unit_price ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status != 'in_stock' THEN quantity * unit_price ELSE 0 END), 0),
        COALESCE(SUM(quantity * unit_price), 0)
    INTO v_gross_revenue, v_gross_advance, v_total_items_price
    FROM order_items WHERE order_id = NEW.id;
    
    v_shipping := COALESCE(NEW.shipping_cost, 0);
    v_net_total := COALESCE(NEW.total_amount, 0);
    v_discount := (v_total_items_price + v_shipping) - v_net_total;

    -- Account resolution
    v_account_cash := NEW.payment_account_id;
    IF v_account_cash IS NULL THEN
        SELECT id INTO v_account_cash FROM accounts WHERE code = '1001' LIMIT 1;
    END IF;

    SELECT id INTO v_account_sales FROM accounts WHERE code = '4001' LIMIT 1;
    SELECT id INTO v_account_advances FROM accounts WHERE name = 'Anticipos de Clientes' LIMIT 1;
    SELECT id INTO v_account_shipping FROM accounts WHERE code = '4002' LIMIT 1;
    SELECT id INTO v_account_discount FROM accounts WHERE code = '4101' LIMIT 1;

    -- Debit Cash
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_id', v_account_cash, 'debit', v_net_total, 'credit', 0));
    
    -- Debit Discount (if any)
    IF v_discount > 0.01 THEN
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_id', v_account_discount, 'debit', v_discount, 'credit', 0));
    END IF;

    -- Credit Revenue (proportional discount applied if simple)
    -- Actually let's just credit gross and debit discount as is.
    IF v_gross_revenue > 0 THEN
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_id', v_account_sales, 'debit', 0, 'credit', v_gross_revenue));
    END IF;

    -- Credit Advances
    IF v_gross_advance > 0 THEN
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_id', v_account_advances, 'debit', 0, 'credit', v_gross_advance));
    END IF;

    -- Credit Shipping
    IF v_shipping > 0 THEN
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_id', v_account_shipping, 'debit', 0, 'credit', v_shipping));
    END IF;

    PERFORM create_transaction_v1('Venta Orden #' || NEW.id, 'sale_order', NEW.id, v_lines);

    RETURN NEW;
END;
$$;

-- 4. RPC for Split Fulfillment (Shipping specific items)
CREATE OR REPLACE FUNCTION ship_order_items(
    p_order_id INTEGER,
    p_item_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item_id UUID;
BEGIN
    -- Update items to 'shipped'
    UPDATE order_items 
    SET status = 'shipped' 
    WHERE id = ANY(p_item_ids) AND order_id = p_order_id;
    
    -- The existing trigger 'tr_update_order_status' will automatically
    -- recalculate the parent order status based on all items.
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Adjust trigger condition: now fires on 'processing' (first payment/confirmation)
DROP TRIGGER IF EXISTS tr_orders_financial_transaction ON orders;
CREATE TRIGGER tr_orders_financial_transaction
AFTER UPDATE ON orders
FOR EACH ROW
WHEN (NEW.status IN ('processing', 'completed') AND OLD.status = 'draft')
EXECUTE FUNCTION process_order_financial_transaction();
