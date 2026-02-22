-- Migration: Quick Stock Adjustment — With Merma (Shrinkage) Support
-- When quantity_change is negative, the caller may pass p_merma_account_id
-- to record the inventory loss as a financial entry (debit to loss account).

CREATE OR REPLACE FUNCTION process_quick_stock_adjustment(
    p_warehouse_id           INT,
    p_payment_account_id     INT,  -- Nullable: payment account for PURCHASES
    p_merma_account_id       INT,  -- Nullable: expense account for SHRINKAGE losses
    p_products               JSONB -- [{ product_id, quantity_change, unit_cost_with_vat }]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product_record          JSONB;
    v_product_id              INT;
    v_quantity_change         INT;
    v_unit_cost_with_vat      NUMERIC;

    v_current_stock           INT;
    v_merchandise_account_id  INT;
    v_total_purchase_amount   NUMERIC := 0;
    v_total_merma_amount      NUMERIC := 0;
    v_purchase_tx_id          INT;
    v_merma_tx_id             INT;

    v_processed_count         INT := 0;
BEGIN
    -- 1a. Validate merchandise account if this is a purchase
    IF p_payment_account_id IS NOT NULL THEN
        SELECT id INTO v_merchandise_account_id
        FROM accounts WHERE name = 'Compra de mercadería' LIMIT 1;

        IF v_merchandise_account_id IS NULL THEN
            RETURN jsonb_build_object('success', false,
                'message', 'Cuenta "Compra de mercadería" no encontrada.');
        END IF;
    END IF;

    -- 2. Process each product
    FOR v_product_record IN SELECT * FROM jsonb_array_elements(p_products)
    LOOP
        v_product_id         := (v_product_record->>'product_id')::INT;
        v_quantity_change    := (v_product_record->>'quantity_change')::INT;
        v_unit_cost_with_vat := (v_product_record->>'unit_cost_with_vat')::NUMERIC;

        IF v_quantity_change = 0 THEN
            CONTINUE;
        END IF;

        -- Pessimistic lock
        SELECT quantity INTO v_current_stock
        FROM inventory_levels
        WHERE product_id = v_product_id AND warehouse_id = p_warehouse_id
        FOR UPDATE;

        IF NOT FOUND THEN
            IF v_quantity_change < 0 THEN
                RAISE EXCEPTION 'No hay inventario previo para este producto en este almacén.';
            END IF;
            INSERT INTO inventory_levels (product_id, warehouse_id, quantity)
            VALUES (v_product_id, p_warehouse_id, v_quantity_change);
        ELSE
            IF v_current_stock + v_quantity_change < 0 THEN
                RAISE EXCEPTION 'Stock insuficiente (Producto ID: %). Disponible: %, requerido restar: %.',
                    v_product_id, v_current_stock, ABS(v_quantity_change);
            END IF;

            UPDATE inventory_levels
               SET quantity     = quantity + v_quantity_change,
                   last_updated = now()
             WHERE product_id = v_product_id AND warehouse_id = p_warehouse_id;
        END IF;

        -- Audit log
        INSERT INTO inventory_logs
            (product_id, warehouse_id, quantity_change, reason, user_id, reference_type)
        VALUES (
            v_product_id,
            p_warehouse_id,
            v_quantity_change,
            CASE
                WHEN v_quantity_change < 0 AND p_merma_account_id IS NOT NULL THEN 'merma'
                WHEN v_quantity_change < 0 THEN 'correction'
                WHEN p_payment_account_id IS NOT NULL               THEN 'quick_purchase'
                ELSE 'manual_adjustment'
            END,
            auth.uid(),
            'stock_adjustment'
        );

        -- Accumulate financial totals
        IF v_quantity_change > 0 AND p_payment_account_id IS NOT NULL THEN
            v_total_purchase_amount := v_total_purchase_amount + (v_unit_cost_with_vat * v_quantity_change);
        END IF;

        IF v_quantity_change < 0 AND p_merma_account_id IS NOT NULL THEN
            v_total_merma_amount := v_total_merma_amount + (v_unit_cost_with_vat * ABS(v_quantity_change));
        END IF;

        v_processed_count := v_processed_count + 1;
    END LOOP;

    -- 3a. Purchase financial transaction
    IF p_payment_account_id IS NOT NULL AND v_total_purchase_amount > 0 THEN
        INSERT INTO transactions (description, reference_type, created_at)
        VALUES ('Compra rápida de mercadería', 'purchase', NOW())
        RETURNING id INTO v_purchase_tx_id;

        -- Payment account is credited (money leaves)
        INSERT INTO transaction_lines (transaction_id, account_id, credit, debit)
        VALUES (v_purchase_tx_id, p_payment_account_id, v_total_purchase_amount, 0);

        -- Merchandise asset is debited (value enters)
        INSERT INTO transaction_lines (transaction_id, account_id, credit, debit)
        VALUES (v_purchase_tx_id, v_merchandise_account_id, 0, v_total_purchase_amount);
    END IF;

    -- 3b. Merma (shrinkage) financial transaction
    IF p_merma_account_id IS NOT NULL AND v_total_merma_amount > 0 THEN
        -- Find the merchandise asset account to credit (value leaves)
        SELECT id INTO v_merchandise_account_id
        FROM accounts WHERE name = 'Compra de mercadería' LIMIT 1;

        INSERT INTO transactions (description, reference_type, created_at)
        VALUES ('Baja de inventario por merma', 'adjustment', NOW())
        RETURNING id INTO v_merma_tx_id;

        -- Expense/loss account is debited (loss is registered)
        INSERT INTO transaction_lines (transaction_id, account_id, credit, debit)
        VALUES (v_merma_tx_id, p_merma_account_id, 0, v_total_merma_amount);

        -- Merchandise asset is credited (inventory value decreases)
        IF v_merchandise_account_id IS NOT NULL THEN
            INSERT INTO transaction_lines (transaction_id, account_id, credit, debit)
            VALUES (v_merma_tx_id, v_merchandise_account_id, v_total_merma_amount, 0);
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success',          true,
        'processed_count',  v_processed_count,
        'purchase_tx_id',   v_purchase_tx_id,
        'merma_tx_id',      v_merma_tx_id,
        'total_purchase',   v_total_purchase_amount,
        'total_merma',      v_total_merma_amount,
        'message',          CASE
            WHEN v_purchase_tx_id IS NOT NULL AND v_merma_tx_id IS NOT NULL
                THEN 'Ajuste procesado con transacción de compra y merma.'
            WHEN v_purchase_tx_id IS NOT NULL
                THEN 'Ajuste procesado con transacción de compra.'
            WHEN v_merma_tx_id IS NOT NULL
                THEN 'Merma registrada contablemente.'
            ELSE 'Ajuste de inventario procesado.'
        END
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
