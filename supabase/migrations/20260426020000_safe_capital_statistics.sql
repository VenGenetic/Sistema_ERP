-- Migration: Safe Capital Statistics (Creates Missing Tables + Fixes Types)
-- Timestamp: 20260426020000

-- Create the missing 'product_compatibilities' table just in case it was never applied
CREATE TABLE IF NOT EXISTS product_compatibilities (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year_from INTEGER NOT NULL,
    year_to INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(product_id, make, model, year_from, year_to)
);

-- Ensure it has the correct permissions
ALTER TABLE product_compatibilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON product_compatibilities;
CREATE POLICY "Allow read access for authenticated users" ON product_compatibilities FOR SELECT TO authenticated USING (true);


-- 1. Agrupación por Categoría (Casteando tipos para evitar mismatch en UI)
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


-- 2. Agrupación por Modelo de Moto
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
