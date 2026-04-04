-- Optimización del Dashboard y Base de Datos (Fase 1)
-- 1. Función RPC para realizar todos los cálculos pesados estadísticos en el backend (PostgreSQL)

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today_start timestamp := date_trunc('day', now());
    v_today_sales numeric;
    v_my_today_sales numeric;
    v_low_stock_count int;
    v_total_skus int;
    v_net_liquidity numeric;
    v_capital_cost numeric;
    v_capital_pvp numeric;
    v_top_lost_demand jsonb;
    v_result jsonb;
BEGIN
    -- 1. Ventas e Ingresos (Filtrado rápido con índices)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_today_sales
    FROM orders
    WHERE created_at >= v_today_start;

    SELECT COALESCE(SUM(total_amount), 0) INTO v_my_today_sales
    FROM orders
    WHERE created_at >= v_today_start AND closer_id = p_user_id;

    -- 2. Salud del Inventario (Suma agregada directamente en motor SQL)
    WITH product_stock AS (
        SELECT 
            p.id as product_id,
            COALESCE(p.min_stock_threshold, 10) as min_stock,
            COALESCE(SUM(il.current_stock), 0) as total_stock
        FROM products p
        LEFT JOIN inventory_levels il ON il.product_id = p.id
        GROUP BY p.id, p.min_stock_threshold
    )
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE total_stock <= min_stock) as low_stock
    INTO v_total_skus, v_low_stock_count
    FROM product_stock;

    -- 3. Liquidez Neta
    SELECT COALESCE(SUM(current_balance), 0) INTO v_net_liquidity
    FROM account_balances
    WHERE category = 'asset';
    
    -- 4. Valorización del Inventario (Capital)
    SELECT 
        COALESCE(SUM(il.current_stock * (p.cost_without_vat * (1 + (COALESCE(p.vat_percentage, 15) / 100.0)))), 0),
        COALESCE(SUM(il.current_stock * p.price), 0)
    INTO v_capital_cost, v_capital_pvp
    FROM inventory_levels il
    JOIN products p ON p.id = il.product_id;

    -- 5. Demanda Perdida Top Rank
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_top_lost_demand
    FROM (
        SELECT upper(TRIM(search_term)) as term, count(*) as count
        FROM lost_demand
        WHERE search_term IS NOT NULL AND search_term != ''
        GROUP BY upper(TRIM(search_term))
        ORDER BY count DESC
        LIMIT 5
    ) t;

    -- 6. Empaquetar todo en de vuelta al cliente
    v_result := jsonb_build_object(
        'todaySales', v_today_sales,
        'myTodaySales', v_my_today_sales,
        'lowStockCount', COALESCE(v_low_stock_count, 0),
        'totalSkus', COALESCE(v_total_skus, 0),
        'netLiquidity', v_net_liquidity,
        'capitalCost', v_capital_cost,
        'capitalPvp', v_capital_pvp,
        'topLostDemand', v_top_lost_demand
    );

    RETURN v_result;
END;
$$;

-- 2. CREACIÓN DE ÍNDICES ESTRATÉGICOS (Agilizan drásticamente los cálculos de backend y frontend)
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_closer_id ON orders(closer_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_lost_demand_term ON lost_demand(search_term);

-- Refrescar metadatos de supabase (Opcional, útil para PostgREST)
NOTIFY pgrst, 'reload schema';
