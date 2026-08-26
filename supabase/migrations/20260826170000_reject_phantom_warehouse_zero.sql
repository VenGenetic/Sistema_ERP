-- Migration: Rechazar bodega 0 en productos que sí llevan inventario
-- Timestamp: 20260826170000
--
-- Contexto: bodega 0 es la señal de "producto manual / venta libre, no toca
-- inventario" que leen process_pos_sale y modify_completed_sale con su
-- `IF v_item.warehouse_id != 0`. El POS la usaba también como valor por
-- descarte al recargar un borrador (orders.warehouse_id nunca se llena, y
-- order_items no guarda bodega), así que las ventas cobradas desde un
-- borrador se registraban y cobraban sin descontar el repuesto, sin dejar
-- movimiento en inventory_logs y sin fallar. 387 líneas / 397 unidades
-- salieron así entre abril y agosto de 2026.
--
-- El cliente ya resuelve la bodega real (utils/warehouseResolution.ts), pero
-- eso vive en el navegador. Esta guarda cierra el agujero en el servidor: si
-- un producto tiene aunque sea una fila en inventory_levels, no puede
-- venderse como venta libre. Los productos manuales (MANUAL-…) nunca tienen
-- filas ahí, así que siguen funcionando exactamente igual.

CREATE OR REPLACE FUNCTION assert_warehouse_zero_is_free_sale(p_product_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_sku TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM inventory_levels WHERE product_id = p_product_id) THEN
        SELECT sku INTO v_sku FROM products WHERE id = p_product_id;
        RAISE EXCEPTION
            'El repuesto % (ID %) tiene inventario y no puede venderse como venta libre. Vuelve a agregarlo buscándolo en el POS para que salga de su bodega.',
            COALESCE(v_sku, '?'), p_product_id;
    END IF;
END;
$$;

-- ============================================================
-- process_pos_sale: misma lógica, con la guarda en el STEP 1
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

        IF v_item.warehouse_id = 0 THEN
            -- Guarda nueva: bodega 0 sólo es legítima para productos que
            -- nunca han estado en inventario.
            PERFORM assert_warehouse_zero_is_free_sale(v_item.product_id);
        ELSE
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
