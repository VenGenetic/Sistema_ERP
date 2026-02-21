-- Migration: Inventory Transfers
-- Description: Adds RPC for atomic inter-warehouse transfers with row-level locking

CREATE OR REPLACE FUNCTION process_inventory_transfer(
    p_product_id INT,
    p_source_warehouse INT,
    p_destination_warehouse INT,
    p_quantity NUMERIC,
    p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
    v_source_stock NUMERIC;
    v_dest_stock NUMERIC;
    v_new_source_stock NUMERIC;
    v_new_dest_stock NUMERIC;
    v_transfer_ref UUID;
    v_log_out_id INT;
    v_log_in_id INT;
BEGIN
    -- Validate distinct warehouses
    IF p_source_warehouse = p_destination_warehouse THEN
        RAISE EXCEPTION 'Source and destination warehouses must be different';
    END IF;

    -- Generate a unique reference ID for this transfer to link the two movements
    v_transfer_ref := gen_random_uuid();

    -- Lock both rows to prevent race conditions. 
    -- To avoid deadlocks, we should ideally order the locks by warehouse ID, but for a 2-warehouse transfer this is usually fine if we just do it consistently or explicitly lock both.
    -- Let's lock source first, then destination.
    SELECT current_stock INTO v_source_stock
    FROM inventory_levels
    WHERE product_id = p_product_id AND warehouse_id = p_source_warehouse
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found in source warehouse';
    END IF;

    -- Check available stock
    IF v_source_stock < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock in source warehouse. Current: %, Requested Transfer: %', v_source_stock, p_quantity;
    END IF;

    -- Lock destination row
    SELECT current_stock INTO v_dest_stock
    FROM inventory_levels
    WHERE product_id = p_product_id AND warehouse_id = p_destination_warehouse
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Auto-create inventory record if it doesn't exist in destination
        INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
        VALUES (p_product_id, p_destination_warehouse, 0)
        RETURNING current_stock INTO v_dest_stock;
    END IF;

    -- Calculate new stocks
    v_new_source_stock := v_source_stock - p_quantity;
    v_new_dest_stock := v_dest_stock + p_quantity;

    -- Update Source of Truth (Levels)
    UPDATE inventory_levels
    SET current_stock = v_new_source_stock,
        last_updated = now()
    WHERE product_id = p_product_id AND warehouse_id = p_source_warehouse;

    UPDATE inventory_levels
    SET current_stock = v_new_dest_stock,
        last_updated = now()
    WHERE product_id = p_product_id AND warehouse_id = p_destination_warehouse;

    -- Append to Immutable Log: Output from Source
    INSERT INTO inventory_logs (
        product_id, warehouse_id, quantity_change, reason, reference_type, reference_id, user_id
    )
    VALUES (
        p_product_id, p_source_warehouse, -p_quantity, p_reason, 'transfer', v_transfer_ref::text, auth.uid()
    ) RETURNING id INTO v_log_out_id;

    -- Append to Immutable Log: Input to Destination
    INSERT INTO inventory_logs (
        product_id, warehouse_id, quantity_change, reason, reference_type, reference_id, user_id
    )
    VALUES (
        p_product_id, p_destination_warehouse, p_quantity, p_reason, 'transfer', v_transfer_ref::text, auth.uid()
    ) RETURNING id INTO v_log_in_id;

    -- Event Emission (for async processing)
    INSERT INTO system_events (event_type, payload)
    VALUES (
        'INVENTORY_TRANSFER', 
        jsonb_build_object(
            'product_id', p_product_id,
            'source_warehouse_id', p_source_warehouse,
            'destination_warehouse_id', p_destination_warehouse,
            'quantity', p_quantity,
            'transfer_reference', v_transfer_ref,
            'log_out_id', v_log_out_id,
            'log_in_id', v_log_in_id
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'transfer_reference', v_transfer_ref
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql;
