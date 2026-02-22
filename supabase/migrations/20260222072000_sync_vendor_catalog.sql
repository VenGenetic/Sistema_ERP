-- sync_vendor_catalog RPC
-- Supports smart merge with COALESCE for optional fields.
-- React enforces all required values before calling this function.
-- For new products: profit_margin and vat_percentage MUST be provided by the UI.

CREATE OR REPLACE FUNCTION sync_vendor_catalog(
    p_products JSONB
)
RETURNS JSON
LANGUAGE plpgsql
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
            sku, name, cost_without_vat, profit_margin, category, vat_percentage, strike_count, strike_price_candidate
        )
        SELECT 
            sku, 
            name, 
            cost_without_vat,
            profit_margin,      -- React ensures this is always set for new products
            category,
            vat_percentage,     -- React ensures this is always set (via fallback prompt)
            0 AS strike_count,              
            NULL AS strike_price_candidate  
        FROM parsed_data
        
        ON CONFLICT (sku) DO UPDATE 
        SET 
            name = EXCLUDED.name,
            cost_without_vat = EXCLUDED.cost_without_vat,
            
            -- SMART MERGE: If Excel didn't provide it (NULL), keep the current table data
            profit_margin = COALESCE(EXCLUDED.profit_margin, products.profit_margin),
            category = COALESCE(EXCLUDED.category, products.category),
            vat_percentage = COALESCE(EXCLUDED.vat_percentage, products.vat_percentage),
            
            -- MASTER OVERRIDE: Reset the strikes
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
