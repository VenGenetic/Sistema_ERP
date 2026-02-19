-- Migration: Make Financial Transaction Optional in Batch Entry
-- Description: Updates process_batch_product_entry to accept nullable p_payment_account_id.

CREATE OR REPLACE FUNCTION process_batch_product_entry(
    p_brand_id BIGINT,
    p_warehouse_id INT,
    p_vat_percentage NUMERIC,
    p_payment_account_id INT, -- Now Nullable
    p_products JSONB -- Array of objects: { sku, name, cost_without_vat, profit_margin, quantity }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product_record JSONB;
    v_sku TEXT;
    v_name TEXT;
    v_cost NUMERIC;
    v_input_margin NUMERIC;
    v_quantity INT;
    
    v_existing_product_id BIGINT;
    v_current_margin NUMERIC;
    v_final_margin NUMERIC;
    v_final_cost_to_store NUMERIC;
    
    v_processed_count INT := 0;
    v_total_transaction_amount NUMERIC := 0;
    v_transaction_id INT;
    v_merchandise_account_id INT;
BEGIN
    -- Only check for merchandise account if we are doing a financial transaction
    IF p_payment_account_id IS NOT NULL THEN
        SELECT id INTO v_merchandise_account_id FROM accounts WHERE name = 'Compra de mercadería' LIMIT 1;
        
        IF v_merchandise_account_id IS NULL THEN
             RETURN jsonb_build_object('success', false, 'message', 'Cuenta "Compra de mercadería" no encontrada (1.1.05).');
        END IF;
    END IF;

    -- Iterate over each product in the JSON array
    FOR v_product_record IN SELECT * FROM jsonb_array_elements(p_products)
    LOOP
        v_sku := v_product_record->>'sku';
        v_name := v_product_record->>'name';
        v_cost := (v_product_record->>'cost_without_vat')::NUMERIC;
        v_input_margin := (v_product_record->>'profit_margin')::NUMERIC;
        v_quantity := (v_product_record->>'quantity')::INT; 

        -- 1. Find or Create Product
        SELECT id, profit_margin INTO v_existing_product_id, v_current_margin
        FROM products
        WHERE sku = v_sku;

        -- Margin Logic
        IF v_existing_product_id IS NOT NULL THEN
            IF v_input_margin > v_current_margin THEN
                v_final_margin := v_input_margin;
            ELSE
                v_final_margin := v_current_margin;
            END IF;
        ELSE
            v_final_margin := v_input_margin;
            INSERT INTO products (sku, name, brand_id, vat_percentage, profit_margin, category)
            VALUES (v_sku, v_name, p_brand_id, p_vat_percentage, v_final_margin, 'General') 
            RETURNING id INTO v_existing_product_id;
        END IF;

        -- Update Product
        UPDATE products
        SET brand_id = p_brand_id,
            name = v_name,
            profit_margin = v_final_margin
        WHERE id = v_existing_product_id;
        
        -- Cost Logic
        PERFORM process_product_entry_cost(
            v_existing_product_id,
            v_cost, 
            NULL, 
            p_vat_percentage,
            auth.uid()
        );
        
        -- Price Update
        SELECT cost_without_vat INTO v_final_cost_to_store FROM products WHERE id = v_existing_product_id;
        IF v_final_cost_to_store IS NOT NULL THEN
             UPDATE products
             SET price = v_final_cost_to_store * (1 + v_final_margin) * (1 + p_vat_percentage / 100)
             WHERE id = v_existing_product_id;
        END IF;

        -- 2. INVENTORY UPDATE
        INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
        VALUES (v_existing_product_id, p_warehouse_id, v_quantity)
        ON CONFLICT (product_id, warehouse_id) 
        DO UPDATE SET current_stock = inventory_levels.current_stock + v_quantity;

        -- Log inventory movement
        INSERT INTO inventory_logs (product_id, warehouse_id, quantity_change, reason, user_id, reference_type, reference_id)
        VALUES (v_existing_product_id, p_warehouse_id, v_quantity, 'batch_entry', auth.uid(), 'batch_import', NULL);

        -- Accumulate Total Cost for Transaction (Cost * Quantity) only if needed
        IF p_payment_account_id IS NOT NULL THEN
            v_total_transaction_amount := v_total_transaction_amount + (v_cost * (1 + p_vat_percentage / 100) * v_quantity);
        END IF;

        v_processed_count := v_processed_count + 1;
    END LOOP;

    -- 3. FINANCIAL TRANSACTION (Only if account provided and amount > 0)
    IF p_payment_account_id IS NOT NULL AND v_total_transaction_amount > 0 THEN
        INSERT INTO transactions (description, reference_type, created_at)
        VALUES ('Compra de mercadería (Lote)', 'purchase', NOW())
        RETURNING id INTO v_transaction_id;

        -- Credit (Payment Account)
        INSERT INTO transaction_lines (transaction_id, account_id, credit, debit)
        VALUES (v_transaction_id, p_payment_account_id, v_total_transaction_amount, 0);

        -- Debit (Merchandise Account)
        INSERT INTO transaction_lines (transaction_id, account_id, credit, debit)
        VALUES (v_transaction_id, v_merchandise_account_id, 0, v_total_transaction_amount);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', CASE WHEN p_payment_account_id IS NULL THEN 'Lote procesado (Solo Inventario).' ELSE 'Lote procesado con transacción financiera.' END,
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
