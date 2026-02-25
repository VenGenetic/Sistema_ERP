-- Migration: ERP Gamification & Workflow Phase 2
-- Description: RPCs for Point Generation and Line-Level Payment Release
-- Timestamp: 20260225020000

-- ==============================================================================
-- 1. Generic Point Logging RPC (For M1, M3, M4, and Clawbacks)
-- ==============================================================================
CREATE OR REPLACE FUNCTION award_gamification_points(
    p_user_id UUID,
    p_milestone TEXT,
    p_points NUMERIC,
    p_order_item_id INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status TEXT := 'frozen';
    v_record_id UUID;
BEGIN
    -- Validate milestone
    IF p_milestone NOT IN ('M1_Sales', 'M2_Sourcing', 'M3_Data', 'M4_Finance', 'Clawback') THEN
        RAISE EXCEPTION 'Invalid milestone: %', p_milestone;
    END IF;

    -- Clawbacks are logged with 'clawback' status directly, effectively applying as negative adjustment at payout
    -- If p_points is positive for clawback, we store it as a negative value
    IF p_milestone = 'Clawback' THEN
        v_status := 'clawback';
        IF p_points > 0 THEN
            p_points := -p_points;
        END IF;
    END IF;

    -- Insert into ledger
    INSERT INTO point_ledger (user_id, order_item_id, milestone, points, status)
    VALUES (p_user_id, p_order_item_id, p_milestone, p_points, v_status)
    RETURNING id INTO v_record_id;

    RETURN jsonb_build_object(
        'success', true, 
        'ledger_id', v_record_id,
        'points_logged', p_points,
        'status', v_status
    );
END;
$$;

-- ==============================================================================
-- 2. Sourcing specific RPC (M2) - Evaluates savings for 1.5x multiplier
-- ==============================================================================
CREATE OR REPLACE FUNCTION generate_m2_sourcing_points(
    p_user_id UUID,
    p_order_item_id INTEGER,
    p_base_points NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_unit_cost NUMERIC;
    v_base_cost NUMERIC;
    v_final_points NUMERIC := p_base_points;
    v_multiplier NUMERIC := 1.0;
    v_record_id UUID;
BEGIN
    -- Get Costs from the order item and the core product
    SELECT oi.unit_cost, p.cost_without_vat
    INTO v_unit_cost, v_base_cost
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.id = p_order_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order item not found';
    END IF;

    -- Check for savings (unit_cost is strictly lower than base cost and not zero)
    IF v_unit_cost > 0 AND v_base_cost > 0 AND v_unit_cost < v_base_cost THEN
        v_multiplier := 1.5;
        v_final_points := p_base_points * 1.5;
    END IF;

    -- Insert points
    INSERT INTO point_ledger (user_id, order_item_id, milestone, points, status)
    VALUES (p_user_id, p_order_item_id, 'M2_Sourcing', v_final_points, 'frozen')
    RETURNING id INTO v_record_id;

    RETURN jsonb_build_object(
        'success', true, 
        'ledger_id', v_record_id,
        'points_logged', v_final_points, 
        'multiplier', v_multiplier
    );
END;
$$;

-- ==============================================================================
-- 3. Line-Level Payment & Release RPC
-- ==============================================================================
CREATE OR REPLACE FUNCTION release_line_payment(
    p_order_item_id INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_gp NUMERIC;
    v_pool_amount NUMERIC := 0;
    v_month_year DATE;
    v_released_count INTEGER;
BEGIN
    -- 1. Get the order item and calculate Gross Profit
    SELECT oi.*, p.cost_without_vat, (oi.unit_price - oi.unit_cost) * oi.quantity AS gross_profit
    INTO v_item
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.id = p_order_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order item not found';
    END IF;

    IF v_item.is_paid THEN
        RETURN jsonb_build_object('success', true, 'message', 'Line is already paid and released.');
    END IF;

    -- 2. Mark line as paid
    UPDATE order_items SET is_paid = true WHERE id = p_order_item_id;

    -- 3. Release points for this specific line for all participants (Sales, Sourcing, etc.)
    WITH updated AS (
        UPDATE point_ledger 
        SET status = 'released', updated_at = now()
        WHERE order_item_id = p_order_item_id AND status = 'frozen'
        RETURNING id
    )
    SELECT count(*) INTO v_released_count FROM updated;

    -- 4. Calculate 10% of GP and inject into Global Pool
    v_gp := COALESCE(v_item.gross_profit, 0);
    IF v_gp > 0 THEN
        v_pool_amount := v_gp * 0.10;
        
        -- Current month truncate to first day (e.g., '2026-02-01')
        v_month_year := date_trunc('month', CURRENT_DATE)::DATE;

        -- Upsert into global pool
        INSERT INTO global_pool (month_year, total_pool_amount)
        VALUES (v_month_year, v_pool_amount)
        ON CONFLICT (month_year) 
        DO UPDATE SET 
            total_pool_amount = global_pool.total_pool_amount + EXCLUDED.total_pool_amount,
            updated_at = now();
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'lines_released', v_released_count, 
        'gp_contribution', v_pool_amount,
        'gross_profit', v_gp
    );
END;
$$;
