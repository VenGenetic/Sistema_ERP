-- Migration: Capital Analytics by Category and Model
-- Timestamp: 20260426000000

-- 1. Agrupación por Categoría (Ej. Moshock, Espejos, etc.)
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
        COALESCE(p.category, 'Sin Categoría') as group_name,
        COALESCE(SUM(il.current_stock * (p.cost_without_vat * (1 + (COALESCE(p.vat_percentage, 15) / 100.0)))), 0) as capital_cost,
        COALESCE(SUM(il.current_stock * p.price), 0) as capital_pvp,
        COALESCE(SUM(il.current_stock), 0) as total_items
    FROM products p
    JOIN inventory_levels il ON p.id = il.product_id
    WHERE il.current_stock > 0
    GROUP BY COALESCE(p.category, 'Sin Categoría')
    ORDER BY capital_cost DESC;
END;
$$;

-- 2. Agrupación por Modelo de Moto (Ej. Tekken, GN125, etc.)
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
        COALESCE(pc.model, 'Modelo Desconocido') as group_name,
        COALESCE(SUM(il.current_stock * (p.cost_without_vat * (1 + (COALESCE(p.vat_percentage, 15) / 100.0)))), 0) as capital_cost,
        COALESCE(SUM(il.current_stock * p.price), 0) as capital_pvp,
        COALESCE(SUM(il.current_stock), 0) as total_items
    FROM product_compatibilities pc
    JOIN products p ON pc.product_id = p.id
    JOIN inventory_levels il ON p.id = il.product_id
    WHERE il.current_stock > 0
    GROUP BY COALESCE(pc.model, 'Modelo Desconocido')
    ORDER BY capital_cost DESC;
END;
$$;
