-- ============================================================
-- Migration: Fix Financial Trigger Status + Dashboard Timezone
-- Timestamp: 20260514180000
-- ============================================================
-- Problem 1: The financial trigger fires WHEN (NEW.status = 'completed')
--            but process_pos_sale now sets orders to 'Entregado'::order_status_enum.
--            These never match so transaction_lines are never written for POS sales.
-- Problem 2: get_dashboard_stats uses date_trunc('day', now()) which anchors to
--            UTC midnight, not Ecuador midnight (UTC-5). This causes "Today's Sales"
--            to be wrong by 5 hours.
-- Fix: Rebuild trigger with correct status cast, rebuild RPC with AT TIME ZONE.
-- ============================================================

-- ============================================================
-- 1. Rebuild the financial trigger with the correct status
-- ============================================================
DROP TRIGGER IF EXISTS tr_orders_financial_transaction ON orders;

CREATE TRIGGER tr_orders_financial_transaction
AFTER UPDATE ON orders
FOR EACH ROW
WHEN (NEW.status::text = 'Entregado' AND OLD.status::text IS DISTINCT FROM 'Entregado')
EXECUTE FUNCTION process_order_financial_transaction();

-- ============================================================
-- 2. Rebuild get_dashboard_stats with Ecuador timezone (UTC-5)
--    and correct 'Entregado' status filter
-- ============================================================
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

    -- 5. Valorización del inventario
    SELECT
        COALESCE(SUM(il.current_stock * (p.cost_without_vat * (1 + COALESCE(p.vat_percentage, 15) / 100.0))), 0),
        COALESCE(SUM(il.current_stock * p.price), 0)
    INTO v_capital_cost, v_capital_pvp
    FROM  inventory_levels il
    JOIN  products p ON p.id = il.product_id;

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

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
