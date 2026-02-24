-- Migration: Micro-Nudge Margins (Architect Refined)
-- Timestamp: 20260223190000

-- 1. Add columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS min_margin NUMERIC(15,4) DEFAULT 0.15,
ADD COLUMN IF NOT EXISTS max_margin NUMERIC(15,4) DEFAULT 0.45,
ADD COLUMN IF NOT EXISTS margin_last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Create Trigger to automate margin_last_updated_at
CREATE OR REPLACE FUNCTION update_margin_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- If the margin changed manually (or via script), reset the cooldown clock
    IF NEW.profit_margin IS DISTINCT FROM OLD.profit_margin THEN
        NEW.margin_last_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_margin_timestamp ON products;
CREATE TRIGGER trigger_update_margin_timestamp
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_margin_timestamp();

-- 3. Create RPC for micro-nudges
CREATE OR REPLACE FUNCTION apply_micro_nudges()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_sales_30d NUMERIC;
    v_nudge NUMERIC;
    v_new_margin NUMERIC;
    v_new_price NUMERIC;
    v_updated_count INT := 0;
BEGIN
    -- Loop through products where the 30-day cooldown has expired
    FOR v_record IN 
        SELECT id, cost_without_vat, vat_percentage, profit_margin, min_margin, max_margin 
        FROM products 
        WHERE (NOW() - margin_last_updated_at) > INTERVAL '30 days'
    LOOP
        -- Calculate valid sales velocity (completed/paid only)
        SELECT COALESCE(SUM(quantity), 0) INTO v_sales_30d
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.product_id = v_record.id
          AND o.created_at > (NOW() - INTERVAL '30 days')
          AND (o.status = 'completed' OR o.payment_status = 'paid');

        v_nudge := 0;

        IF v_sales_30d > 30 THEN
            -- Fast Mover: +0.5% (as decimal 0.005)
            v_nudge := 0.005;
        ELSIF v_sales_30d = 0 THEN
            -- Dead Stock: -1.0% (as decimal 0.01)
            v_nudge := -0.01;
        END IF;

        IF v_nudge <> 0 THEN
            v_new_margin := GREATEST(v_record.min_margin, LEAST(v_record.max_margin, v_record.profit_margin + v_nudge));
            
            IF v_new_margin <> v_record.profit_margin THEN
                -- Recalculate price: (cost * (1 + vat/100)) * (1 + margin)
                v_new_price := (v_record.cost_without_vat * (1 + (v_record.vat_percentage / 100))) * (1 + v_new_margin);
                
                UPDATE products
                SET profit_margin = v_new_margin,
                    price = v_new_price
                WHERE id = v_record.id;
                
                v_updated_count := v_updated_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'updated_count', v_updated_count,
        'message', 'Micro-nudges applied successfully.'
    );
END;
$$;

-- 4. Update sync_vendor_catalog to respect new design
-- (The trigger handles the timestamp, but we still need price recalculation here)
CREATE OR REPLACE FUNCTION sync_vendor_catalog(
    p_products JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inserted INT := 0;
    v_updated INT := 0;
BEGIN
    WITH parsed_data AS (
        SELECT 
            (elem->>'sku')::TEXT AS sku,
            (elem->>'name')::TEXT AS name,
            (elem->>'cost_without_vat')::NUMERIC AS cost_without_vat,
            (elem->>'profit_margin')::NUMERIC AS profit_margin,
            (elem->>'category')::TEXT AS category,
            (elem->>'vat_percentage')::NUMERIC AS vat_percentage
        FROM jsonb_array_elements(p_products) AS elem
    ),
    upsert_action AS (
        INSERT INTO products (
            sku, name, cost_without_vat, profit_margin, category, vat_percentage, strike_count, strike_price_candidate, price
        )
        SELECT 
            sku, 
            name, 
            cost_without_vat,
            profit_margin,
            category,
            vat_percentage,
            0 AS strike_count,              
            NULL AS strike_price_candidate,
            (cost_without_vat * (1 + (vat_percentage / 100))) * (1 + profit_margin) AS price
        FROM parsed_data
        
        ON CONFLICT (sku) DO UPDATE 
        SET 
            name = EXCLUDED.name,
            cost_without_vat = EXCLUDED.cost_without_vat,
            profit_margin = COALESCE(EXCLUDED.profit_margin, products.profit_margin),
            category = COALESCE(EXCLUDED.category, products.category),
            vat_percentage = COALESCE(EXCLUDED.vat_percentage, products.vat_percentage),
            
            -- Recalculate price
            price = (EXCLUDED.cost_without_vat * (1 + (COALESCE(EXCLUDED.vat_percentage, products.vat_percentage) / 100))) * (1 + COALESCE(EXCLUDED.profit_margin, products.profit_margin)),

            strike_count = 0,               
            strike_price_candidate = NULL
        RETURNING xmax
    )
    SELECT 
        COUNT(*) FILTER (WHERE xmax = 0),     
        COUNT(*) FILTER (WHERE xmax::text::int > 0) 
    INTO v_inserted, v_updated
    FROM upsert_action;

    RETURN json_build_object(
        'success', true,
        'message', 'Catalog synchronized successfully',
        'inserted_count', v_inserted,
        'updated_count', v_updated
    );
END;
$$;
