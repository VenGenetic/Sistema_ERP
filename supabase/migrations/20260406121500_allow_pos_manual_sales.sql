-- Migration: Allow POS Manual Sales
-- Description: Replaces process_pos_sale to skip inventory verification and price floor checks for manual items (warehouse_id = 0)

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
    v_vat_percent NUMERIC;
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

    -- STEP 3: Create the Order AS DRAFT (Borrador)
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
        'Borrador',
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

    -- STEP 5: Mark as Entregado (triggers financial accounting)
    UPDATE orders SET status = 'Entregado' WHERE id = v_order_id;

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
