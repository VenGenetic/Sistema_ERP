-- 1. Crear columna local_stock en tabla products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS local_stock INTEGER DEFAULT 0;

-- 2. Inicializar la columna con la suma actual de stock local
UPDATE public.products p
SET local_stock = COALESCE(
    (SELECT SUM(current_stock) 
     FROM public.inventory_levels 
     WHERE product_id = p.id), 
    0
);

-- 3. Crear función trigger para mantener el stock local sincronizado
CREATE OR REPLACE FUNCTION update_product_local_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE public.products
        SET local_stock = COALESCE(
            (SELECT SUM(current_stock) 
             FROM public.inventory_levels 
             WHERE product_id = OLD.product_id), 
            0
        )
        WHERE id = OLD.product_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Si cambió el product_id (caso raro), actualizar ambos
        IF NEW.product_id <> OLD.product_id THEN
            UPDATE public.products
            SET local_stock = COALESCE(
                (SELECT SUM(current_stock) 
                 FROM public.inventory_levels 
                 WHERE product_id = OLD.product_id), 
                0
            )
            WHERE id = OLD.product_id;
        END IF;
        
        UPDATE public.products
        SET local_stock = COALESCE(
            (SELECT SUM(current_stock) 
             FROM public.inventory_levels 
             WHERE product_id = NEW.product_id), 
            0
        )
        WHERE id = NEW.product_id;
        RETURN NEW;
    ELSE -- INSERT
        UPDATE public.products
        SET local_stock = COALESCE(
            (SELECT SUM(current_stock) 
             FROM public.inventory_levels 
             WHERE product_id = NEW.product_id), 
            0
        )
        WHERE id = NEW.product_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Crear el disparador (Trigger)
DROP TRIGGER IF EXISTS trigger_update_product_local_stock ON public.inventory_levels;
CREATE TRIGGER trigger_update_product_local_stock
AFTER INSERT OR UPDATE OR DELETE ON public.inventory_levels
FOR EACH ROW
EXECUTE FUNCTION update_product_local_stock();
