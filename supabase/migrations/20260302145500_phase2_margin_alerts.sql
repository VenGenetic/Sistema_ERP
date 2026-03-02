-- Migration: Phase 2 Margin Alerts
-- Timestamp: 20260302145500

-- Create function to check margin and alert
CREATE OR REPLACE FUNCTION check_order_margin()
RETURNS TRIGGER AS $$
DECLARE
    v_margin NUMERIC;
BEGIN
    -- Only check if cost or price actually changed and both are > 0 to avoid div by zero
    IF (NEW.unit_cost IS DISTINCT FROM OLD.unit_cost OR NEW.unit_price IS DISTINCT FROM OLD.unit_price) AND NEW.unit_price > 0 THEN
        v_margin := (NEW.unit_price - NEW.unit_cost) / NEW.unit_price;
        
        -- If margin is less than 15%, alert
        IF v_margin < 0.15 THEN
            -- Update parent order to Alerta_Margen
            UPDATE public.orders 
            SET status = 'Alerta_Margen'
            WHERE id = NEW.order_id AND status != 'Alerta_Margen';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_check_order_margin ON public.order_items;

-- Create AFTER UPDATE trigger
-- We use AFTER UPDATE because modifying the parent order from a BEFORE UPDATE on a child 
-- is allowed but AFTER is generally safer for cross-table updates.
CREATE TRIGGER trigger_check_order_margin
AFTER UPDATE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION check_order_margin();
