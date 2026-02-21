-- Migration: Fitment Search Optimization
-- Description: Creates RPCs for fetching fast fitment filtering options and performing advanced fast search.

-- 1. RPC to get unique Makes
CREATE OR REPLACE FUNCTION get_unique_makes()
RETURNS TABLE (make TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT pc.make
    FROM product_compatibilities pc
    ORDER BY pc.make;
END;
$$;

-- 2. RPC to get unique Models for a given Make
CREATE OR REPLACE FUNCTION get_models_by_make(p_make TEXT)
RETURNS TABLE (model TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT pc.model
    FROM product_compatibilities pc
    WHERE pc.make = p_make
    ORDER BY pc.model;
END;
$$;

-- 3. RPC to search inventory directly (Heavily optimized Inner Join)
CREATE OR REPLACE FUNCTION search_inventory_by_fitment(
    p_make TEXT DEFAULT NULL,
    p_model TEXT DEFAULT NULL,
    p_year INTEGER DEFAULT NULL
)
RETURNS TABLE (
    inventory_id INTEGER,
    warehouse_id INTEGER,
    current_stock NUMERIC,
    product_id INTEGER,
    product_name TEXT,
    product_sku TEXT,
    product_category TEXT,
    product_min_stock NUMERIC,
    product_price NUMERIC,
    product_cost NUMERIC,
    product_margin NUMERIC,
    brand_name TEXT,
    warehouse_name TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        il.id AS inventory_id,
        il.warehouse_id,
        il.current_stock,
        p.id AS product_id,
        p.name AS product_name,
        p.sku AS product_sku,
        p.category AS product_category,
        p.min_stock_threshold AS product_min_stock,
        p.price AS product_price,
        p.cost_without_vat AS product_cost,
        p.profit_margin AS product_margin,
        b.name AS brand_name,
        w.name AS warehouse_name
    FROM inventory_levels il
    INNER JOIN products p ON il.product_id = p.id
    LEFT JOIN brands b ON p.brand_id = b.id
    INNER JOIN warehouses w ON il.warehouse_id = w.id
    -- The core optimized INNER JOIN for fitment
    INNER JOIN product_compatibilities pc ON p.id = pc.product_id
    WHERE 
        (p_make IS NULL OR pc.make = p_make)
        AND (p_model IS NULL OR pc.model = p_model)
        AND (p_year IS NULL OR (p_year >= pc.year_from AND p_year <= pc.year_to))
    -- Distinct is needed in case one product fits multiple trims of the same exact make/model/year
    GROUP BY 
        il.id, il.warehouse_id, il.current_stock, p.id, p.name, p.sku, p.category, 
        p.min_stock_threshold, p.price, p.cost_without_vat, p.profit_margin, b.name, w.name;
END;
$$;
