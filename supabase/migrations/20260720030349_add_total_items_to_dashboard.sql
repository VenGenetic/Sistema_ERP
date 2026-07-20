-- Migration: Add Total Items to Dashboard Stats
-- Timestamp: 20260720030349

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today_start timestamptz;
    v_today_sales  numeric;
    v_my_today_sales numeric;
    v_low_stock_count int;
    v_total_skus   int;
    v_total_items  int;
    v_net_liquidity numeric;
    v_capital_cost  numeric;
    v_capital_pvp   numeric;
    v_top_lost_demand jsonb;
    v_result       jsonb;
BEGIN
    v_today_start := (date_trunc('day', now() AT TIME ZONE 'America/Guayaquil')
                      AT TIME ZONE 'America/Guayaquil');

    SELECT COALESCE(SUM(total_amount), 0)
    INTO   v_today_sales
    FROM   orders
    WHERE  created_at >= v_today_start
      AND  status::text = 'Entregado';

    SELECT COALESCE(SUM(total_amount), 0)
    INTO   v_my_today_sales
    FROM   orders
    WHERE  created_at >= v_today_start
      AND  status::text = 'Entregado'
      AND  closer_id = p_user_id;

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
        COUNT(*) FILTER (WHERE total_stock <= min_stock)    AS low_stock,
        COALESCE(SUM(total_stock), 0)                       AS sum_stock
    INTO v_total_skus, v_low_stock_count, v_total_items
    FROM product_stock;

    SELECT COALESCE(SUM(current_balance), 0)
    INTO   v_net_liquidity
    FROM   account_balances
    WHERE  category = 'asset';

    -- 5. Valorización del inventario
    SELECT COALESCE(SUM(p.cost_without_vat * il.current_stock), 0),
           COALESCE(SUM(p.price * il.current_stock), 0)
    INTO v_capital_cost, v_capital_pvp
    FROM products p
    JOIN inventory_levels il ON p.id = il.product_id;

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

    v_result := jsonb_build_object(
        'todaySales',    v_today_sales,
        'myTodaySales',  v_my_today_sales,
        'lowStockCount', COALESCE(v_low_stock_count, 0),
        'totalSkus',     COALESCE(v_total_skus, 0),
        'totalItems',    COALESCE(v_total_items, 0),
        'netLiquidity',  v_net_liquidity,
        'capitalCost',   v_capital_cost,
        'capitalPvp',    v_capital_pvp,
        'topLostDemand', v_top_lost_demand
    );

    RETURN v_result;
END;
$$;
