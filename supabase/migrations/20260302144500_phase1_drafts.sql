-- Migration: Phase 1 Drafts & Status Enum
-- Timestamp: 20260302144500

-- 1. Storage Buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('product_references', 'product_references', true),
  ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public reading and authenticated uploading
DROP POLICY IF EXISTS "product_references_public_access" ON storage.objects;
CREATE POLICY "product_references_public_access" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'product_references');

DROP POLICY IF EXISTS "product_references_auth_uploads" ON storage.objects;
CREATE POLICY "product_references_auth_uploads" 
    ON storage.objects FOR INSERT 
    TO authenticated 
    WITH CHECK (bucket_id = 'product_references');

DROP POLICY IF EXISTS "receipts_public_access" ON storage.objects;
CREATE POLICY "receipts_public_access" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "receipts_auth_uploads" ON storage.objects;
CREATE POLICY "receipts_auth_uploads" 
    ON storage.objects FOR INSERT 
    TO authenticated 
    WITH CHECK (bucket_id = 'receipts');

-- 2. Products table changes
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'official')),
ADD COLUMN IF NOT EXISTS reference_image_url TEXT,
ALTER COLUMN sku DROP NOT NULL;

-- Set existing products to official if they have a SKU
UPDATE public.products SET status = 'official' WHERE sku IS NOT NULL AND status = 'draft';

-- 3. Orders Status ENUM
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status_enum') THEN
        CREATE TYPE order_status_enum AS ENUM (
            'Borrador', 
            'Pendiente_Pago', 
            'Listo_Cumplimiento', 
            'Sourcing_Pendiente', 
            'Alerta_Margen', 
            'En_Transito', 
            'Entregado', 
            'RMA_Pendiente', 
            'Cancelado',
            'Reembolsado'
        );
    END IF;
END$$;

-- ============================================================
-- DROP ALL DEPENDENT OBJECTS before altering the column type
-- ============================================================

-- Drop dependent view
DROP VIEW IF EXISTS employee_earnings_summary;

-- Drop dependent triggers on orders that reference status
DROP TRIGGER IF EXISTS tr_orders_financial_transaction ON orders;

-- Drop check constraint and default
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ALTER COLUMN status DROP DEFAULT;

-- ============================================================
-- ALTER the column type
-- ============================================================
ALTER TABLE public.orders 
ALTER COLUMN status TYPE order_status_enum 
USING (
  CASE status
    WHEN 'draft' THEN 'Borrador'
    WHEN 'quote' THEN 'Borrador'
    WHEN 'pending_verification' THEN 'Pendiente_Pago'
    WHEN 'processing_fulfillment' THEN 'Listo_Cumplimiento'
    WHEN 'ready_for_pickup' THEN 'Listo_Cumplimiento'
    WHEN 'shipped' THEN 'En_Transito'
    WHEN 'completed' THEN 'Entregado'
    WHEN 'cancelled' THEN 'Cancelado'
    WHEN 'lost' THEN 'Cancelado'
    ELSE 'Borrador'
  END
)::order_status_enum;

ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'Borrador'::order_status_enum;

-- ============================================================
-- RECREATE all dependent objects with new ENUM values
-- ============================================================

-- 4a. Recreate employee_earnings_summary view
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
    AND o.status IN ('Entregado'::order_status_enum, 'Listo_Cumplimiento'::order_status_enum, 'En_Transito'::order_status_enum)
GROUP BY p.id, p.full_name, p.referral_code;

-- 4b. Recreate the financial transaction trigger with the new ENUM value
CREATE TRIGGER tr_orders_financial_transaction
AFTER UPDATE ON orders
FOR EACH ROW
WHEN (NEW.status = 'Entregado'::order_status_enum AND OLD.status IS DISTINCT FROM 'Entregado'::order_status_enum)
EXECUTE FUNCTION process_order_financial_transaction();

-- ============================================================
-- 5. Update process_pos_sale to use new ENUM values
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
            RAISE EXCEPTION 'El precio unitario ($%) para el producto ID % está por debajo del mínimo ($%). Se requiere un mínimo de 5%% de margen.', 
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

-- ============================================================
-- 6. Update save_draft_order to use new ENUM values
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
    v_resolved_closer_id := p_closer_id;
    
    IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
        SELECT id INTO v_resolved_closer_id
        FROM profiles
        WHERE referral_code = upper(trim(p_promo_code));
        
        IF v_resolved_closer_id IS NULL THEN
            RAISE EXCEPTION 'Código promo inválido: %', p_promo_code;
        END IF;
    END IF;

    FOREACH v_item IN ARRAY p_items
    LOOP
        v_total_amount := v_total_amount + (v_item.quantity * v_item.unit_price);
    END LOOP;

    v_total_amount := v_total_amount + p_shipping_cost;

    IF p_draft_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_draft_id AND status = 'Borrador') THEN
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
            'Borrador',
            v_total_amount, 
            p_shipping_cost
        )
        RETURNING id INTO v_order_id;
    END IF;

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
