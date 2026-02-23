-- Migration: Setup Financial Triggers for Orders and Add Nominal Accounts
-- Timestamp: 20260223105000

-- ============================================================
-- 1. Insert Missing Nominal Accounts
-- ============================================================
INSERT INTO accounts (code, name, category, is_nominal, currency, position) VALUES
('4002', 'Ingresos por Envío', 'income', true, 'USD', 20),
('4101', 'Descuentos sobre Ventas', 'income', true, 'USD', 30), -- Contra-revenue behaves like income with debit balances
('5101', 'Gastos de Envío', 'expense', true, 'USD', 20)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. Add payment_account_id and shipping_expense_account_id to orders
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_account_id INTEGER REFERENCES accounts(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_expense_account_id INTEGER REFERENCES accounts(id);

-- ============================================================
-- 3. Replace process_pos_sale (Drop direct finance logic, use draft -> completed workflow)
-- ============================================================
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
            RAISE EXCEPTION 'El cliente debe tener email y teléfono registrados para usar un código promo. Actualice los datos del cliente.';
        END IF;
    END IF;

    -- STEP 1: Calculate totals, verify stock, enforce price guardrails
    FOREACH v_item IN ARRAY p_items
    LOOP
        SELECT current_stock INTO v_current_stock
        FROM inventory_levels
        WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id
        FOR UPDATE;

        IF NOT FOUND OR v_current_stock < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto ID % en bodega %', v_item.product_id, v_item.warehouse_id;
        END IF;

        SELECT cost_without_vat, COALESCE(vat_percentage, 0), price
        INTO v_product_cost, v_price_floor, v_product_price
        FROM products
        WHERE id = v_item.product_id;

        v_price_floor := v_product_cost * (1 + v_price_floor / 100) * 1.05;
        v_price_ceiling := v_product_price * 1.15;

        IF v_item.unit_price < v_price_floor THEN
            RAISE EXCEPTION 'El precio unitario ($%) para el producto ID % está por debajo del mínimo ($%). Se requiere un mínimo de 5%% de margen. Para vender a un precio menor, se necesita autorización de un gerente.', 
                round(v_item.unit_price, 2), v_item.product_id, round(v_price_floor, 2);
        END IF;

        IF v_item.unit_price > v_price_ceiling THEN
            RAISE EXCEPTION 'El precio unitario ($%) para el producto ID % supera el máximo permitido ($%). Máximo 15%% sobre PVP.', 
                round(v_item.unit_price, 2), v_item.product_id, round(v_price_ceiling, 2);
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

    -- STEP 3: Create the Order AS DRAFT
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
        'draft', -- INSERT AS DRAFT SO THE TRIGGER SEES THE ITEMS LATER
        v_total_amount, 
        p_shipping_cost,
        p_shipping_address,
        p_payment_account_id,
        p_shipping_expense_account_id
    )
    RETURNING id INTO v_order_id;

    -- STEP 4: Process each item
    FOREACH v_item IN ARRAY p_items
    LOOP
        UPDATE inventory_levels
        SET current_stock = current_stock - v_item.quantity
        WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id;

        INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost)
        VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.unit_cost);

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

    -- STEP 5: Make it COMPLETED (This triggers the new financial accounting trigger)
    UPDATE orders SET status = 'completed' WHERE id = v_order_id;

    -- STEP 6: Return Success
    RETURN jsonb_build_object(
        'success', true, 
        'order_id', v_order_id, 
        'total_amount', v_total_amount,
        'promo_discount', v_promo_discount,
        'closer_id', v_resolved_closer_id
    );
END;
$$;


-- ============================================================
-- 4. Create Financial Accounting Trigger for Double-Entry Books
-- ============================================================
CREATE OR REPLACE FUNCTION process_order_financial_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_gross_products NUMERIC := 0;
    v_discount NUMERIC := 0;
    v_shipping NUMERIC := 0;
    v_net_total NUMERIC := 0;
    
    v_account_cash INTEGER;
    v_account_sales INTEGER;
    v_account_shipping INTEGER;
    v_account_discount INTEGER;
    v_account_shipping_expense INTEGER;
    
    v_lines JSONB := '[]'::jsonb;
    v_expense_lines JSONB := '[]'::jsonb;
    v_has_tx BOOLEAN;
    v_transaction_id INTEGER;
BEGIN
    -- 1. Ensure transaction doesn't exist already to prevent duplicates
    SELECT EXISTS (SELECT 1 FROM transactions WHERE order_id = NEW.id) INTO v_has_tx;
    IF v_has_tx THEN
        RETURN NEW;
    END IF;

    -- 2. Calculate values FROM order_items
    SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_gross_products
    FROM order_items WHERE order_id = NEW.id;
    
    v_shipping := COALESCE(NEW.shipping_cost, 0);
    v_net_total := COALESCE(NEW.total_amount, 0);
    
    -- Real discount is (gross products + shipping) - what we actually charge them
    v_gross_products := ROUND(v_gross_products, 2);
    v_shipping := ROUND(v_shipping, 2);
    v_net_total := ROUND(v_net_total, 2);
    v_discount := ROUND((v_gross_products + v_shipping) - v_net_total, 2);

    -- Avoid negative discounts (just lower gross revenue if there's a surcharge anomaly)
    IF v_discount < 0 THEN
        v_gross_products := ROUND(v_gross_products - v_discount, 2);
        v_discount := 0;
    END IF;

    -- Avoid creating zero-value transactions if everything is 0
    IF v_net_total = 0 AND v_gross_products = 0 AND v_shipping = 0 THEN
        RETURN NEW;
    END IF;

    -- 3. Get Account IDs
    IF NEW.payment_account_id IS NOT NULL THEN
        v_account_cash := NEW.payment_account_id;
    ELSE
        SELECT id INTO v_account_cash FROM accounts WHERE code = '1001' LIMIT 1;
        IF v_account_cash IS NULL THEN
            SELECT id INTO v_account_cash FROM accounts WHERE category = 'asset' LIMIT 1;
        END IF;
    END IF;

    SELECT id INTO v_account_sales FROM accounts WHERE code = '4001' LIMIT 1;
    SELECT id INTO v_account_shipping FROM accounts WHERE code = '4002' LIMIT 1;
    SELECT id INTO v_account_discount FROM accounts WHERE code = '4101' LIMIT 1;
    SELECT id INTO v_account_shipping_expense FROM accounts WHERE code = '5101' LIMIT 1;

    -- Validate we have accounts
    IF v_account_cash IS NULL OR v_account_sales IS NULL THEN
        RAISE WARNING 'Cannot create transaction for order %: Missing essential accounts', NEW.id;
        RETURN NEW;
    END IF;

    -- 4. Build Transaction Lines (Debits = Credits exactly)
    -- Debit Cash (v_net_total)
    IF v_net_total > 0 THEN
        v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_id', v_account_cash, 'debit', v_net_total, 'credit', 0)
        );
    END IF;

    -- Debit Discount (v_discount) to represent lost revenue
    IF v_discount > 0 THEN
        IF v_account_discount IS NULL THEN
            RAISE EXCEPTION 'Account 4101 (Descuentos) is missing';
        END IF;
        v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_id', v_account_discount, 'debit', v_discount, 'credit', 0)
        );
    END IF;

    -- Credit Sales (v_gross_products) to nominal revenue
    IF v_gross_products > 0 THEN
        v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_id', v_account_sales, 'debit', 0, 'credit', v_gross_products)
        );
    END IF;

    -- Credit Shipping (v_shipping) to nominal shipping revenue
    IF v_shipping > 0 THEN
        IF v_account_shipping IS NULL THEN
            RAISE EXCEPTION 'Account 4002 (Envío) is missing';
        END IF;
        v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_id', v_account_shipping, 'debit', 0, 'credit', v_shipping)
        );
    END IF;

    -- 5. Invoke create_transaction_v1 for Sales Income
    IF jsonb_array_length(v_lines) > 0 THEN
        SELECT create_transaction_v1(
            'Orden #' || NEW.id,
            'sale_order',
            NEW.id,
            v_lines
        ) INTO v_transaction_id;
    END IF;

    -- 6. Invoke create_transaction_v1 for Shipping Expense (Courier Payment)
    IF NEW.shipping_expense_account_id IS NOT NULL AND v_shipping > 0 THEN
        IF v_account_shipping_expense IS NULL THEN
            RAISE EXCEPTION 'Account 5101 (Gastos de Envío) is missing';
        END IF;

        v_expense_lines := jsonb_build_array(
            jsonb_build_object('account_id', v_account_shipping_expense, 'debit', v_shipping, 'credit', 0),
            jsonb_build_object('account_id', NEW.shipping_expense_account_id, 'debit', 0, 'credit', v_shipping)
        );

        SELECT create_transaction_v1(
            'Pago de Envío - Orden #' || NEW.id,
            'shipping_expense',
            NEW.id,
            v_expense_lines
        ) INTO v_transaction_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_orders_financial_transaction ON orders;
CREATE TRIGGER tr_orders_financial_transaction
AFTER UPDATE ON orders
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
EXECUTE FUNCTION process_order_financial_transaction();
