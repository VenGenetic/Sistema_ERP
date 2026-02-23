-- Migration: Promo Codes, Sales Attribution & Pricing Guardrails
-- Timestamp: 20260222200000

-- ============================================================
-- 1. AUTO-GENERATE REFERRAL CODES FOR PROFILES
-- ============================================================

-- Function to generate a random 6-char alphanumeric code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    -- Only generate if referral_code is null
    IF NEW.referral_code IS NOT NULL THEN
        RETURN NEW;
    END IF;

    LOOP
        -- Generate 6-character uppercase alphanumeric code
        v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        
        -- Check for collision
        SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = v_code) INTO v_exists;
        
        EXIT WHEN NOT v_exists;
    END LOOP;

    NEW.referral_code := v_code;
    RETURN NEW;
END;
$$;

-- Create trigger on profiles
DROP TRIGGER IF EXISTS trg_generate_referral_code ON profiles;
CREATE TRIGGER trg_generate_referral_code
    BEFORE INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION generate_referral_code();

-- Backfill existing profiles that have NULL referral codes
DO $$
DECLARE
    r RECORD;
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    FOR r IN SELECT id FROM profiles WHERE referral_code IS NULL
    LOOP
        LOOP
            v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
            SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = v_code) INTO v_exists;
            EXIT WHEN NOT v_exists;
        END LOOP;
        
        UPDATE profiles SET referral_code = v_code WHERE id = r.id;
    END LOOP;
END;
$$;


-- ============================================================
-- 2. UPDATE process_pos_sale WITH PROMO & GUARDRAIL LOGIC
-- ============================================================

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
    -- ========================================
    -- STEP 0: Resolve promo code → closer_id
    -- ========================================
    v_resolved_closer_id := p_closer_id; -- Default to passed value
    
    IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
        -- Look up the referral code in profiles
        SELECT id INTO v_resolved_closer_id
        FROM profiles
        WHERE referral_code = upper(trim(p_promo_code));
        
        IF v_resolved_closer_id IS NULL THEN
            RAISE EXCEPTION 'Código promo inválido: %', p_promo_code;
        END IF;
        
        -- Validate customer has email and phone
        SELECT email, phone INTO v_customer_email, v_customer_phone
        FROM customers
        WHERE id = p_customer_id;
        
        IF v_customer_email IS NULL OR v_customer_email = '' 
           OR v_customer_phone IS NULL OR v_customer_phone = '' THEN
            RAISE EXCEPTION 'El cliente debe tener email y teléfono registrados para usar un código promo. Actualice los datos del cliente.';
        END IF;
    END IF;

    -- ========================================
    -- STEP 1: Calculate totals, verify stock, enforce price guardrails
    -- ========================================
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

        -- Get product cost and price for guardrail checks
        SELECT cost_without_vat, COALESCE(vat_percentage, 0), price
        INTO v_product_cost, v_price_floor, v_product_price
        FROM products
        WHERE id = v_item.product_id;

        -- Calculate floor: cost with VAT + 5% minimum margin (below requires manager override)
        v_price_floor := v_product_cost * (1 + v_price_floor / 100) * 1.05;
        -- Calculate ceiling: 15% above standard PVP
        v_price_ceiling := v_product_price * 1.15;

        -- Enforce price floor (5% minimum margin)
        IF v_item.unit_price < v_price_floor THEN
            RAISE EXCEPTION 'El precio unitario ($%) para el producto ID % está por debajo del mínimo ($%). Se requiere un mínimo de 5%% de margen. Para vender a un precio menor, se necesita autorización de un gerente.', 
                round(v_item.unit_price, 2), v_item.product_id, round(v_price_floor, 2);
        END IF;

        -- Enforce price ceiling
        IF v_item.unit_price > v_price_ceiling THEN
            RAISE EXCEPTION 'El precio unitario ($%) para el producto ID % supera el máximo permitido ($%). Máximo 15%% sobre PVP.', 
                round(v_item.unit_price, 2), v_item.product_id, round(v_price_ceiling, 2);
        END IF;

        -- Track manual discount for non-stackable logic
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

    -- ========================================
    -- STEP 2: Apply promo discount (non-stackable)
    -- ========================================
    IF v_resolved_closer_id IS NOT NULL AND p_promo_code IS NOT NULL AND p_promo_code != '' THEN
        -- Non-stackable: only apply 3% if no manual discount exceeds 3%
        IF v_max_manual_discount_pct <= 3 THEN
            v_promo_discount := v_total_amount * 0.03;
            v_total_amount := v_total_amount - v_promo_discount;
        END IF;
        -- If manual discount > 3%, promo code still tracks closer but no extra discount
    END IF;

    v_total_amount := v_total_amount + p_shipping_cost;

    -- ========================================
    -- STEP 3: Create the Order
    -- ========================================
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
        v_resolved_closer_id, 
        p_promo_code, 
        'completed',
        v_total_amount, 
        p_shipping_cost,
        p_shipping_address
    )
    RETURNING id INTO v_order_id;

    -- ========================================
    -- STEP 4: Process each item
    -- ========================================
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

    -- ========================================
    -- STEP 5: Financial Transaction
    -- ========================================
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

    -- ========================================
    -- STEP 6: Return Success
    -- ========================================
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
-- 3. UPDATE save_draft_order TO RESOLVE PROMO CODE
-- ============================================================

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
    v_resolved_closer_id UUID;
BEGIN
    -- Resolve promo code → closer_id (no discount on drafts, just attribution)
    v_resolved_closer_id := p_closer_id;
    
    IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
        SELECT id INTO v_resolved_closer_id
        FROM profiles
        WHERE referral_code = upper(trim(p_promo_code));
        
        IF v_resolved_closer_id IS NULL THEN
            RAISE EXCEPTION 'Código promo inválido: %', p_promo_code;
        END IF;
    END IF;

    -- Calculate totals (no stock deduction for drafts)
    FOREACH v_item IN ARRAY p_items
    LOOP
        v_total_amount := v_total_amount + (v_item.quantity * v_item.unit_price);
    END LOOP;

    v_total_amount := v_total_amount + p_shipping_cost;

    -- Create or Update the Order Draft
    IF p_draft_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_draft_id AND status = 'draft') THEN
            RAISE EXCEPTION 'This order cannot be edited because it is no longer a draft.';
        END IF;

        UPDATE orders SET
            customer_id = p_customer_id,
            closer_id = v_resolved_closer_id,
            promo_code = p_promo_code,
            total_amount = v_total_amount,
            shipping_cost = p_shipping_cost
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
            shipping_cost
        )
        VALUES (
            p_customer_id, 
            v_resolved_closer_id, 
            p_promo_code, 
            'draft',
            v_total_amount, 
            p_shipping_cost
        )
        RETURNING id INTO v_order_id;
    END IF;

    -- Insert new Order Items
    FOREACH v_item IN ARRAY p_items
    LOOP
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost)
        VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.unit_cost);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'order_id', v_order_id, 
        'total_amount', v_total_amount,
        'closer_id', v_resolved_closer_id
    );
END;
$$;


-- ============================================================
-- 4. EMPLOYEE EARNINGS SUMMARY VIEW
-- ============================================================

-- Aggregates completed orders by closer_id for earnings/commission reporting.
-- Closers can query their own data; admins can see all.
DROP VIEW IF EXISTS employee_earnings_summary;
CREATE VIEW employee_earnings_summary AS
SELECT
    p.id AS closer_id,
    p.full_name AS closer_name,
    p.referral_code,
    COUNT(DISTINCT o.id) AS total_orders,
    COALESCE(SUM(o.total_amount), 0) AS total_sales,
    COALESCE(SUM(
        (SELECT SUM((oi.unit_price - oi.unit_cost) * oi.quantity)
         FROM order_items oi WHERE oi.order_id = o.id)
    ), 0) AS total_gross_profit,
    COALESCE(SUM(
        (SELECT SUM((oi.unit_price - oi.unit_cost) * oi.quantity)
         FROM order_items oi WHERE oi.order_id = o.id)
    ), 0) * 0.10 AS earned_commission,
    COUNT(DISTINCT o.id) FILTER (WHERE o.promo_code IS NOT NULL) AS promo_attributed_orders,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.promo_code IS NOT NULL), 0) AS promo_attributed_sales
FROM profiles p
LEFT JOIN orders o 
    ON o.closer_id = p.id 
    AND o.status IN ('completed', 'processing_fulfillment', 'shipped', 'ready_for_pickup')
GROUP BY p.id, p.full_name, p.referral_code;
