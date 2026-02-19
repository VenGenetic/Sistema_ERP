-- Migration: Inventory System Upgrade
-- Description: Adds system_events, enhances inventory_logs, restricts updates/deletes, and adds ACID RPCs.

-- 1. Create system_events table for Event-Driven Architecture
CREATE TABLE IF NOT EXISTS system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 2. Enhance inventory_logs with reference fields for audit
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50); -- e.g., 'order', 'adjustment', 'transfer'
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS reference_id VARCHAR(50);   -- e.g., order_id

-- 3. Enforce Immutability on inventory_logs (Append-Only)
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

-- Remove existing policies if any to avoid conflicts (safe to run if they don't exist, but better to check or drop if exists)
DROP POLICY IF EXISTS "Allow all for authenticated" ON inventory_logs;
DROP POLICY IF EXISTS "Inventory Logs Insert Only" ON inventory_logs;
DROP POLICY IF EXISTS "Inventory Logs Select Only" ON inventory_logs;

-- Policy: Allow INSERT for authenticated users (or service role)
CREATE POLICY "Inventory Logs Insert Only" ON inventory_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Policy: Allow SELECT for authenticated users
CREATE POLICY "Inventory Logs Select Only" ON inventory_logs
    FOR SELECT TO authenticated
    USING (true);

-- Policy: DENY UPDATE/DELETE (This is implicit by NOT creating policies for them, but strictly we can ensure no one can do it unless they are superuser)
-- No UPDATE/DELETE policies created.

-- 4. RPC: Process Inventory Movement (ACID + Concurrency Control)
CREATE OR REPLACE FUNCTION process_inventory_movement(
    p_product_id INT,
    p_warehouse_id INT,
    p_quantity_change NUMERIC,
    p_reason TEXT,
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_current_stock NUMERIC;
    v_new_stock NUMERIC;
    v_log_id INT;
BEGIN
    -- ACID: Start Transaction is implicit in Postgres functions (unless using autonomous transactions which are complex, but for this scope it works within the caller's transaction or starts one)
    
    -- 2. Concurrency Control: Pessimistic Lock
    -- Lock the inventory_levels row for this product/warehouse
    SELECT current_stock INTO v_current_stock
    FROM inventory_levels
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE; -- Blocks other transactions trying to read/update this row

    IF NOT FOUND THEN
        -- Optional: Auto-create inventory record if it doesn't exist? 
        -- For now, let's assume products must be initialized. 
        -- Or we can insert with lock.
        INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
        VALUES (p_product_id, p_warehouse_id, 0)
        RETURNING current_stock INTO v_current_stock;
        
        -- Lock the newly inserted row (though it's ours)
        -- In SERIALIZABLE isolation this might need care, but READ COMMITTED is standard.
    END IF;

    -- Calculate new stock
    v_new_stock := v_current_stock + p_quantity_change;

    -- Basic validation
    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Insufficient stock. Current: %, Requested Change: %', v_current_stock, p_quantity_change;
    END IF;

    -- 3. Update Source of Truth (Levels)
    UPDATE inventory_levels
    SET current_stock = v_new_stock,
        last_updated = now()
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    -- 4. Append to Immutable Log
    INSERT INTO inventory_logs (
        product_id, 
        warehouse_id, 
        quantity_change, 
        reason, 
        reference_type, 
        reference_id, 
        user_id
    )
    VALUES (
        p_product_id, 
        p_warehouse_id, 
        p_quantity_change, 
        p_reason, 
        p_reference_type, 
        p_reference_id, 
        auth.uid() -- Capture who did it
    ) RETURNING id INTO v_log_id;

    -- 5. Event Emission (for async processing)
    INSERT INTO system_events (event_type, payload)
    VALUES (
        'INVENTORY_MOVEMENT', 
        jsonb_build_object(
            'product_id', p_product_id,
            'warehouse_id', p_warehouse_id,
            'old_stock', v_current_stock,
            'new_stock', v_new_stock,
            'change', p_quantity_change,
            'log_id', v_log_id
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'new_stock', v_new_stock, 
        'log_id', v_log_id
    );

EXCEPTION WHEN OTHERS THEN
    -- Transaction automatically rolls back on exception
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- 5. RPC: Reconcile Inventory (Consistency Check)
CREATE OR REPLACE FUNCTION reconcile_inventory(
    p_product_id INT,
    p_warehouse_id INT
) RETURNS JSONB AS $$
DECLARE
    v_current_level NUMERIC;
    v_computed_sum NUMERIC;
BEGIN
    -- Get current level
    SELECT current_stock INTO v_current_level
    FROM inventory_levels
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
    
    -- Sum logs (Source of Truth)
    SELECT COALESCE(SUM(quantity_change), 0) INTO v_computed_sum
    FROM inventory_logs
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
    
    IF v_current_level IS NULL THEN
        v_current_level := 0;
    END IF;

    IF v_current_level != v_computed_sum THEN
        RETURN jsonb_build_object(
            'status', 'mismatch',
            'level_stock', v_current_level,
            'log_sum', v_computed_sum,
            'difference', v_current_level - v_computed_sum
        );
    ELSE
        RETURN jsonb_build_object(
            'status', 'matched',
            'stock', v_current_level
        );
    END IF;
END;
$$ LANGUAGE plpgsql;
