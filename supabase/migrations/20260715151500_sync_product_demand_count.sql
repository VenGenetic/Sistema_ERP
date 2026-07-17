-- Migration: Sync and maintain product demand counts
-- Timestamp: 20260715151500

-- 1. Initialize existing demand counts
UPDATE public.products p
SET demand_count = (
    SELECT COALESCE(COUNT(*), 0)
    FROM public.product_demands d
    WHERE d.product_id = p.id AND d.status IN ('pending_stock', 'stock_available')
);

-- 2. Create trigger function
CREATE OR REPLACE FUNCTION public.trg_update_product_demand_count()
RETURNS TRIGGER AS $$
BEGIN
    -- If INSERT
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.status IN ('pending_stock', 'stock_available')) THEN
            UPDATE public.products
            SET demand_count = COALESCE(demand_count, 0) + 1
            WHERE id = NEW.product_id;
        END IF;
        
    -- If UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        -- If product_id changed (unlikely but handled)
        IF (OLD.product_id <> NEW.product_id) THEN
            IF (OLD.status IN ('pending_stock', 'stock_available')) THEN
                UPDATE public.products
                SET demand_count = GREATEST(0, COALESCE(demand_count, 0) - 1)
                WHERE id = OLD.product_id;
            END IF;
            IF (NEW.status IN ('pending_stock', 'stock_available')) THEN
                UPDATE public.products
                SET demand_count = COALESCE(demand_count, 0) + 1
                WHERE id = NEW.product_id;
            END IF;
        ELSE
            -- Check status change
            DECLARE
                was_active BOOLEAN := (OLD.status IN ('pending_stock', 'stock_available'));
                is_active BOOLEAN := (NEW.status IN ('pending_stock', 'stock_available'));
            BEGIN
                IF (was_active AND NOT is_active) THEN
                    UPDATE public.products
                    SET demand_count = GREATEST(0, COALESCE(demand_count, 0) - 1)
                    WHERE id = NEW.product_id;
                ELSIF (NOT was_active AND is_active) THEN
                    UPDATE public.products
                    SET demand_count = COALESCE(demand_count, 0) + 1
                    WHERE id = NEW.product_id;
                END IF;
            END;
        END IF;
        
    -- If DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.status IN ('pending_stock', 'stock_available')) THEN
            UPDATE public.products
            SET demand_count = GREATEST(0, COALESCE(demand_count, 0) - 1)
            WHERE id = OLD.product_id;
        END IF;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS trg_product_demands_count_sync ON public.product_demands;
CREATE TRIGGER trg_product_demands_count_sync
AFTER INSERT OR UPDATE OR DELETE ON public.product_demands
FOR EACH ROW
EXECUTE FUNCTION public.trg_update_product_demand_count();
