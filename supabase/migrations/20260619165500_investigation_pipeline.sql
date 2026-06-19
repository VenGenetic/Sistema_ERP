-- Migration: Sourcing Pipeline (Product Investigation Fields)
-- Timestamp: 20260619165500

-- Add investigation fields to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS investigation_status TEXT CHECK (investigation_status IN ('pending', 'en_consulta', 'no_encontrado', 'encontrado')),
ADD COLUMN IF NOT EXISTS auto_order_disabled BOOLEAN DEFAULT false;

-- Add index to speed up querying the sourcing pipeline
CREATE INDEX IF NOT EXISTS idx_products_investigation_status ON public.products(investigation_status);
CREATE INDEX IF NOT EXISTS idx_products_auto_order_disabled ON public.products(auto_order_disabled);

-- Function to handle when importer stock arrives, change investigation_status to 'encontrado' if it was 'pending' or 'en_consulta' or 'no_encontrado'
CREATE OR REPLACE FUNCTION trg_check_importer_stock_found()
RETURNS TRIGGER AS $$
BEGIN
    -- If importer_stock changes from 0/null to > 0
    IF ((OLD.importer_stock IS NULL OR OLD.importer_stock = 0) AND NEW.importer_stock > 0) THEN
        -- If it was being investigated, mark as found
        IF NEW.investigation_status IN ('pending', 'en_consulta', 'no_encontrado') THEN
            NEW.investigation_status = 'encontrado';
        END IF;
    END IF;
    
    -- If importer_stock drops to 0, and it was 'encontrado', maybe reset to 'pending' to investigate again?
    IF (OLD.importer_stock > 0 AND (NEW.importer_stock IS NULL OR NEW.importer_stock = 0)) THEN
        IF NEW.investigation_status = 'encontrado' THEN
            NEW.investigation_status = 'pending';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to execute on product stock updates
DROP TRIGGER IF EXISTS trg_products_auto_found ON public.products;
CREATE TRIGGER trg_products_auto_found
BEFORE UPDATE OF importer_stock ON public.products
FOR EACH ROW
EXECUTE FUNCTION trg_check_importer_stock_found();
