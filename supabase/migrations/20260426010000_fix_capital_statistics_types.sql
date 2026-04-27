-- Migration: Fix Type Mismatches in Capital Statistics
-- Timestamp: 20260426010000

-- Explicitly casting the SELECT results to match the RETURNS TABLE signature

CREATE OR REPLACE FUNCTION get_capital_by_category()
RETURNS TABLE (
    group_name TEXT,
    capital_cost NUMERIC,
    capital_pvp NUMERIC,
    total_items NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(p.category, 'Sin Categoría')::TEXT as group_name,
        COALESCE(SUM(il.current_stock * (p.cost_without_vat * (1 + (COALESCE(p.vat_percentage, 15) / 100.0)))), 0)::NUMERIC as capital_cost,
        COALESCE(SUM(il.current_stock * p.price), 0)::NUMERIC as capital_pvp,
        COALESCE(SUM(il.current_stock), 0)::NUMERIC as total_items
    FROM products p
    JOIN inventory_levels il ON p.id = il.product_id
    WHERE il.current_stock > 0
    GROUP BY COALESCE(p.category, 'Sin Categoría')
    ORDER BY capital_cost DESC;
END;
$$;


CREATE OR REPLACE FUNCTION get_capital_by_model()
RETURNS TABLE (
    group_name TEXT,
    capital_cost NUMERIC,
    capital_pvp NUMERIC,
    total_items NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(pc.model, 'Modelo Desconocido')::TEXT as group_name,
        COALESCE(SUM(il.current_stock * (p.cost_without_vat * (1 + (COALESCE(p.vat_percentage, 15) / 100.0)))), 0)::NUMERIC as capital_cost,
        COALESCE(SUM(il.current_stock * p.price), 0)::NUMERIC as capital_pvp,
        COALESCE(SUM(il.current_stock), 0)::NUMERIC as total_items
    FROM product_compatibilities pc
    JOIN products p ON pc.product_id = p.id
    JOIN inventory_levels il ON p.id = il.product_id
    WHERE il.current_stock > 0
    GROUP BY COALESCE(pc.model, 'Modelo Desconocido')
    ORDER BY capital_cost DESC;
END;
$$;
