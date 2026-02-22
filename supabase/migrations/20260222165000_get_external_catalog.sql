-- Migration: Create External Catalog API RPC
-- Timestamp: 20260222165000

-- Create an RPC to fetch catalog for external providers that validates API key
CREATE OR REPLACE FUNCTION get_external_catalog(p_api_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_valid BOOLEAN;
    v_result JSONB;
BEGIN
    -- Validate API key
    SELECT validate_api_key(p_api_key) INTO v_is_valid;
    
    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'Invalid or inactive API key.';
    END IF;

    -- Fetch active products with total inventory
    WITH product_data AS (
        SELECT 
            p.id,
            p.name,
            p.sku,
            p.description,
            p.brand,
            p.pvp,
            p.image_url,
            COALESCE(
                (SELECT SUM(current_stock) 
                 FROM public.inventory_levels il 
                 WHERE il.product_id = p.id), 0
            ) as total_stock
        FROM public.products p
        WHERE p.status = 'active'
    )
    SELECT jsonb_agg(row_to_json(product_data)) INTO v_result
    FROM product_data;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
