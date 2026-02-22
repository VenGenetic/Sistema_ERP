-- Creating the sync_vendor_catalog RPC
-- Supports smart merge: optional fields (profit_margin, category, vat_percentage)
-- use COALESCE to preserve existing DB values when Excel cells are blank.

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
            -- For optional fields, if Excel is blank, the JSON will pass NULL
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
            COALESCE(profit_margin, 0.30), -- Default to 30% if entirely new and blank
            category,
            COALESCE(vat_percentage, 12.0), -- Default to 12% if entirely new and blank
            0 AS strike_count,              
            NULL AS strike_price_candidate  
        FROM parsed_data
        
        -- IF THE SKU ALREADY EXISTS, DO THIS INSTEAD:
        ON CONFLICT (sku) DO UPDATE 
        SET 
            name = EXCLUDED.name, -- Always overwrite name
            cost_without_vat = EXCLUDED.cost_without_vat, -- Always overwrite cost
            
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
