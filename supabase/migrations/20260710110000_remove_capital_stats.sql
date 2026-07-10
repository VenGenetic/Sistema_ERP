-- Migration: Remove Capital Stats and Optimize get_dashboard_stats
-- Timestamp: 20260710110000

-- Drop obsolete capital functions
DROP FUNCTION IF EXISTS get_capital_by_search(text);
DROP FUNCTION IF EXISTS get_capital_by_category();
DROP FUNCTION IF EXISTS get_capital_by_model();

-- Rebuild get_dashboard_stats without capital calculations (sets cost/pvp to 0)
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- Anchor to Ecuador midnight (UTC-5) so "today" is always the local business day
    v_today_start timestamptz;
    v_today_sales  numeric;
    v_my_today_sales numeric;
    v_low_stock_count int;
    v_total_skus   int;
    v_net_liquidity numeric;
    v_capital_cost  numeric;
    v_capital_pvp   numeric;
    v_top_lost_demand jsonb;
    v_result       jsonb;
BEGIN
    -- Compute Ecuador-local midnight expressed as UTC (e.g. 05:00 UTC = midnight ECT)
    v_today_start := (date_trunc('day', now() AT TIME ZONE 'America/Guayaquil')
                      AT TIME ZONE 'America/Guayaquil');

    -- 1. Ventas globales hoy (Entregado = completed POS sales)
    SELECT COALESCE(SUM(total_amount), 0)
    INTO   v_today_sales
    FROM   orders
    WHERE  created_at >= v_today_start
      AND  status::text = 'Entregado';

    -- 2. Mis ventas hoy (atribuidas al usuario que hizo el cierre)
    SELECT COALESCE(SUM(total_amount), 0)
    INTO   v_my_today_sales
    FROM   orders
    WHERE  created_at >= v_today_start
      AND  status::text = 'Entregado'
      AND  closer_id = p_user_id;

    -- 3. Salud del inventario
    WITH product_stock AS (
        SELECT
            p.id                                        AS product_id,
            COALESCE(p.min_stock_threshold, 10)         AS min_stock,
            COALESCE(SUM(il.current_stock), 0)          AS total_stock
        FROM  products p
        LEFT JOIN inventory_levels il ON il.product_id = p.id
        GROUP BY p.id, p.min_stock_threshold
    )
    SELECT
        COUNT(*)                                            AS total,
        COUNT(*) FILTER (WHERE total_stock <= min_stock)    AS low_stock
    INTO v_total_skus, v_low_stock_count
    FROM product_stock;

    -- 4. Liquidez Neta (suma de saldos de cuentas de activo)
    SELECT COALESCE(SUM(current_balance), 0)
    INTO   v_net_liquidity
    FROM   account_balances
    WHERE  category = 'asset';

    -- 5. Valorización del inventario (Desactivado/Eliminado)
    v_capital_cost := 0;
    v_capital_pvp := 0;

    -- 6. Top 5 demanda perdida
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO   v_top_lost_demand
    FROM (
        SELECT upper(trim(search_term)) AS term, count(*) AS count
        FROM   lost_demand
        WHERE  search_term IS NOT NULL AND search_term != ''
        GROUP  BY upper(trim(search_term))
        ORDER  BY count DESC
        LIMIT  5
    ) t;

    -- 7. Build and return JSON payload
    v_result := jsonb_build_object(
        'todaySales',    v_today_sales,
        'myTodaySales',  v_my_today_sales,
        'lowStockCount', COALESCE(v_low_stock_count, 0),
        'totalSkus',     COALESCE(v_total_skus, 0),
        'netLiquidity',  v_net_liquidity,
        'capitalCost',   v_capital_cost,
        'capitalPvp',    v_capital_pvp,
        'topLostDemand', v_top_lost_demand
    );

    RETURN v_result;
END;
$$;
