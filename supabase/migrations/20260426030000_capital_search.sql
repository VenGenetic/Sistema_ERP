-- Migration: Dynamic Capital Search RPC
-- Timestamp: 20260426030000

CREATE OR REPLACE FUNCTION get_capital_by_search(p_keyword TEXT DEFAULT '')
RETURNS TABLE (
    product_id INTEGER,
    product_sku TEXT,
    product_name TEXT,
    category TEXT,
    current_stock NUMERIC,
    capital_cost NUMERIC,
    capital_pvp NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as product_id,
        p.sku::TEXT as product_sku,
        p.name as product_name,
        COALESCE(p.category, 'General')::TEXT as category,
        il.current_stock::NUMERIC,
        (il.current_stock * (p.cost_without_vat * (1 + (COALESCE(p.vat_percentage, 15) / 100.0))))::NUMERIC as capital_cost,
        (il.current_stock * p.price)::NUMERIC as capital_pvp
    FROM products p
    JOIN inventory_levels il ON p.id = il.product_id
    WHERE il.current_stock > 0 
      AND (
          p_keyword = '' 
          OR p.name ILIKE '%' || p_keyword || '%' 
          OR p.sku ILIKE '%' || p_keyword || '%'
      )
    ORDER BY capital_cost DESC;
END;
$$;
