-- Migration: Add is_approved boolean to product_demands and auto-approval logic
-- Timestamp: 20260706000000

-- 1. Add the column
ALTER TABLE public.product_demands ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- 2. Create the auto-approval function
CREATE OR REPLACE FUNCTION public.trg_auto_approve_demand()
RETURNS TRIGGER AS $$
DECLARE
    v_importer_stock NUMERIC;
    v_cost_without_vat NUMERIC;
    v_vat_percentage NUMERIC;
    v_cost_with_iva NUMERIC;
BEGIN
    -- Query the importer stock for the product
    SELECT COALESCE(il.current_stock, 0)
    INTO v_importer_stock
    FROM public.inventory_levels il
    JOIN public.warehouses w ON il.warehouse_id = w.id
    WHERE il.product_id = NEW.product_id AND w.type = 'digital_partner'
    LIMIT 1;

    -- If no record found, default to 0
    IF v_importer_stock IS NULL THEN
        v_importer_stock := 0;
    END IF;

    -- Query the cost and vat for the product
    SELECT 
        COALESCE(cost_without_vat, 0), 
        COALESCE(vat_percentage, 12.0)
    INTO 
        v_cost_without_vat, 
        v_vat_percentage
    FROM public.products
    WHERE id = NEW.product_id;

    -- Calculate Cost with VAT
    v_cost_with_iva := v_cost_without_vat * (1 + (v_vat_percentage / 100.0));

    -- Auto-approve if conditions met: importer stock > 0 and cost with IVA < 50
    IF v_importer_stock > 0 AND v_cost_with_iva < 50 THEN
        NEW.is_approved := true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach the trigger to product_demands
DROP TRIGGER IF EXISTS auto_approve_demand_trigger ON public.product_demands;

CREATE TRIGGER auto_approve_demand_trigger
BEFORE INSERT ON public.product_demands
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_approve_demand();
