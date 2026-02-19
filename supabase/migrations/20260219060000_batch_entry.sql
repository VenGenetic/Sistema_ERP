-- Migration: Batch Product Entry Logic
-- Description: Adds profit_margin and batch processing logic.

-- 1. Add profit_margin to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS profit_margin NUMERIC(5,4) DEFAULT 0.30; -- Default 30% margin

-- 2. Function to process a single product entry (Internal or modified existing)
-- We might need to modify the existing `process_product_entry_cost` to handle margin updates or just do it in the batch loop.
-- Let's create `process_batch_product_entry` that calls logic internally.

CREATE OR REPLACE FUNCTION process_batch_product_entry(
    p_brand_id BIGINT,
    p_vat_percentage NUMERIC,
    p_products JSONB -- Array of objects: { sku, name, cost_without_vat, profit_margin, category (optional) }
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
    v_category TEXT;
    v_input_margin NUMERIC;
    
    v_existing_product_id BIGINT;
    v_current_margin NUMERIC;
    v_final_margin NUMERIC;
    v_final_cost_to_store NUMERIC; -- Costo Oficial FINAL (despues de strikes)
    v_processed_count INT := 0;
    v_result_message TEXT;
BEGIN
    -- Iterate over each product in the JSON array
    FOR v_product_record IN SELECT * FROM jsonb_array_elements(p_products)
    LOOP
        v_sku := v_product_record->>'sku';
        v_name := v_product_record->>'name';
        v_cost := (v_product_record->>'cost_without_vat')::NUMERIC;
        v_input_margin := (v_product_record->>'profit_margin')::NUMERIC;
        v_category := v_product_record->>'category';

        -- 1. Find existing product by SKU
        SELECT id, profit_margin INTO v_existing_product_id, v_current_margin
        FROM products
        WHERE sku = v_sku;

        -- 2. Margin Logic: MAX(current, input)
        IF v_existing_product_id IS NOT NULL THEN
            -- Existing Product
            IF v_input_margin > v_current_margin THEN
                v_final_margin := v_input_margin;
            ELSE
                v_final_margin := v_current_margin;
            END IF;
        ELSE
            -- New Product
            v_final_margin := v_input_margin;
            
            -- Insert basic product first (to get ID for cost logic)
            INSERT INTO products (sku, name, brand_id, vat_percentage, profit_margin, category)
            VALUES (v_sku, v_name, p_brand_id, p_vat_percentage, v_final_margin, v_category)
            RETURNING id INTO v_existing_product_id;
        END IF;

        -- 3. Cost Logic (Reuse process_product_entry_cost logic or call it)
        -- We will call `process_product_entry_cost` for the cost part.
        -- Note: `process_product_entry_cost` updates cost, vat, strikes.
        -- We need to pass the *discounted* cost if available, but here we assume 'cost' is the effective cost.
        -- If the frontend sends separate discounted cost, we should handle it.
        -- Assuming `cost_without_vat` from frontend is already the "effective" cost to be considered.
        
        -- Call existing RPC for Cost Logic (It handles strikes and history)
        -- We need to check if we can call it. The existing RPC takes (p_product_id, p_cost_without_vat, p_discounted_cost, p_vat_percentage).
        -- Let's assume input cost is the *final* cost we want to try to apply.
        
        -- PERFORM process_product_entry_cost(
        --     v_existing_product_id, 
        --     v_cost, -- cost_without_vat
        --     NULL, -- discounted_cost (we assume inputs are already net? or we add discounted field to JSON)
        --     p_vat_percentage
        -- );
        
        -- RE-IMPLEMENTING COST LOGIC INLINE FOR BATCH EFFICIENCY and CONTEXT CONTROL
        -- (Calls to RPC inside loop are fine, but we also need to update Brand/Margin/Name which the other RPC doesn't do)

        -- Update Product Non-Cost Fields (Brand only if new? Or update all?)
        -- Let's update Brand, Name, Category, Margin.
        UPDATE products
        SET brand_id = p_brand_id,
            name = v_name,
            profit_margin = v_final_margin,
            category = COALESCE(v_category, category)
        WHERE id = v_existing_product_id;
        
        -- Execute Cost Logic (Strikes) via internal call or code
        -- Let's use the existing RPC to ensure consistency in Strike logic
        -- We cast to void to ignore result
        PERFORM process_product_entry_cost(
            v_existing_product_id,
            v_cost, -- cost_without_vat
            NULL,   -- discounted_cost (Simplified for batch: user confirms final cost)
            p_vat_percentage
        );
        
        -- 4. Calculate and Update Price (PVP)
        -- Need to fetch the *official* cost after strike logic (it might have changed or not)
        SELECT cost_without_vat INTO v_final_cost_to_store
        FROM products
        WHERE id = v_existing_product_id;
        
        IF v_final_cost_to_store IS NOT NULL THEN
             -- PVP = Cost * (1 + Margin) * (1 + VAT)
             UPDATE products
             SET price = v_final_cost_to_store * (1 + v_final_margin) * (1 + p_vat_percentage / 100)
             WHERE id = v_existing_product_id;
        END IF;

        v_processed_count := v_processed_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Batch processed successfully',
        'processed_count', v_processed_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', SQLERRM
    );
END;
$$;
