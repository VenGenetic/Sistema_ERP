-- Migration: Quick Stock Adjustment with Optional Finance
-- Description: Creates an atomic RPC for simple stock adjustments (add/subtract) with optional payment account linking.

CREATE OR REPLACE FUNCTION process_quick_stock_adjustment(
    p_warehouse_id INT,
    p_payment_account_id INT, -- Nullable
    p_products JSONB -- Array of objects: { product_id, quantity_change, unit_cost_with_vat }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product_record JSONB;
    v_product_id INT;
    v_quantity_change INT;
    v_unit_cost_with_vat NUMERIC;
    
    v_current_stock INT;
    v_merchandise_account_id INT;
    v_total_transaction_amount NUMERIC := 0;
    v_transaction_id INT;
    
    v_processed_count INT := 0;
BEGIN
    -- 1. Validate payment account if provided
    IF p_payment_account_id IS NOT NULL THEN
        SELECT id INTO v_merchandise_account_id FROM accounts WHERE name = 'Compra de mercadería' LIMIT 1;
        
        IF v_merchandise_account_id IS NULL THEN
             RETURN jsonb_build_object('success', false, 'message', 'Cuenta "Compra de mercadería" no encontrada (1.1.05).');
        END IF;
    END IF;

    -- 2. Process each product
    FOR v_product_record IN SELECT * FROM jsonb_array_elements(p_products)
    LOOP
        v_product_id := (v_product_record->>'product_id')::INT;
        v_quantity_change := (v_product_record->>'quantity_change')::INT;
        v_unit_cost_with_vat := (v_product_record->>'unit_cost_with_vat')::NUMERIC;
        
        IF v_quantity_change = 0 THEN
            CONTINUE; -- Skip if no change is requested
        END IF;

        -- Pessimistic Lock for concurrency
        SELECT current_stock INTO v_current_stock
        FROM inventory_levels
        WHERE product_id = v_product_id AND warehouse_id = p_warehouse_id
        FOR UPDATE;

        IF NOT FOUND THEN
            -- Create inventory level if it doesn't exist
            IF v_quantity_change < 0 THEN
                RAISE EXCEPTION 'No se puede restar stock de un producto sin inventario previo en este almacén.';
            END IF;
            
            INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
            VALUES (v_product_id, p_warehouse_id, v_quantity_change);
        ELSE
            IF v_current_stock + v_quantity_change < 0 THEN
                RAISE EXCEPTION 'Stock insuficiente para la operación solicitada (Producto ID: %).', v_product_id;
            END IF;
            
            UPDATE inventory_levels
            SET current_stock = current_stock + v_quantity_change,
                last_updated = now()
            WHERE product_id = v_product_id AND warehouse_id = p_warehouse_id;
        END IF;

        -- Immutable inventory log
        INSERT INTO inventory_logs (product_id, warehouse_id, quantity_change, reason, user_id, reference_type)
        VALUES (
            v_product_id, 
            p_warehouse_id, 
            v_quantity_change, 
            CASE WHEN p_payment_account_id IS NOT NULL THEN 'quick_purchase' ELSE 'manual_adjustment' END, 
            auth.uid(), 
            'stock_adjustment'
        );

        -- Financial accumulation (only for positive additions if account is provided)
        IF p_payment_account_id IS NOT NULL AND v_quantity_change > 0 THEN
            v_total_transaction_amount := v_total_transaction_amount + (v_unit_cost_with_vat * v_quantity_change);
        END IF;

        v_processed_count := v_processed_count + 1;
    END LOOP;

    -- 3. Create financial transaction if requested and amount > 0
    IF p_payment_account_id IS NOT NULL AND v_total_transaction_amount > 0 THEN
        INSERT INTO transactions (description, reference_type, created_at)
        VALUES ('Ajuste rápido de mercadería', 'purchase', NOW())
        RETURNING id INTO v_transaction_id;

        -- Credit the payment account (money leaves)
        INSERT INTO transaction_lines (transaction_id, account_id, credit, debit)
        VALUES (v_transaction_id, p_payment_account_id, v_total_transaction_amount, 0);

        -- Debit merchandise asset (value increases)
        INSERT INTO transaction_lines (transaction_id, account_id, credit, debit)
        VALUES (v_transaction_id, v_merchandise_account_id, 0, v_total_transaction_amount);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', CASE WHEN v_transaction_id IS NOT NULL THEN 'Ajuste procesado con transacción financiera.' ELSE 'Ajuste de inventario procesado.' END,
        'processed_count', v_processed_count,
        'transaction_id', v_transaction_id,
        'total_amount', v_total_transaction_amount
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', SQLERRM
    );
END;
$$;
