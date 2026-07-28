-- 1. Añadir columnas para gestión de sesión e intervalo en inventory_groups
ALTER TABLE public.inventory_groups 
ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS interval_value INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS interval_unit TEXT NOT NULL DEFAULT 'days';

-- 2. Actualizar el procedimiento RPC increment_inventory_group_item para evitar
--    sobreescribir last_counted_at durante el conteo en progreso.
--    Ahora se encarga de iniciar session_started_at si estuviera nulo.
CREATE OR REPLACE FUNCTION public.increment_inventory_group_item(
    p_group_id UUID,
    p_product_id INT,
    p_amount INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.inventory_group_items (group_id, product_id, counted_stock, is_manually_added)
    VALUES (p_group_id, p_product_id, p_amount, true)
    ON CONFLICT (group_id, product_id)
    DO UPDATE SET counted_stock = public.inventory_group_items.counted_stock + p_amount;
    
    -- Iniciar el reloj de las 24 horas si la sesión es nueva / reseteada sin afectar last_counted_at
    UPDATE public.inventory_groups 
    SET session_started_at = COALESCE(session_started_at, timezone('utc'::text, now()))
    WHERE id = p_group_id;
END;
$$;
