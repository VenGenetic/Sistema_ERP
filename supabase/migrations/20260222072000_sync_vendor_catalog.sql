-- Creating the sync_vendor_catalog RPC

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
    -- We use a CTE (Common Table Expression) to parse the JSON array
    WITH parsed_data AS (
        SELECT 
            (elem->>'sku')::TEXT AS sku,
            (elem->>'name')::TEXT AS name,
            (elem->>'cost_without_vat')::NUMERIC AS cost_without_vat
        FROM jsonb_array_elements(p_products) AS elem
    ),
    upsert_action AS (
        INSERT INTO products (sku, name, cost_without_vat, strike_count, strike_price_candidate)
        SELECT 
            sku, 
            name, 
            cost_without_vat,
            0 AS strike_count,              -- Force reset strikes
            NULL AS strike_price_candidate  -- Clear any pending candidate
        FROM parsed_data
        ON CONFLICT (sku) DO UPDATE 
        SET 
            name = EXCLUDED.name,
            cost_without_vat = EXCLUDED.cost_without_vat,
            strike_count = 0,               -- Master Override: Reset strikes on update!
            strike_price_candidate = NULL
        RETURNING xmax -- PostgreSQL magic to determine if it was an insert or update
    )
    SELECT 
        COUNT(*) FILTER (WHERE xmax = 0),     -- 0 means Inserted
        COUNT(*) FILTER (WHERE xmax::text::int > 0) -- > 0 means Updated
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
