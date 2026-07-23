-- Add unique constraint to prevent duplicate items in the same group
ALTER TABLE public.inventory_group_items 
ADD CONSTRAINT inventory_group_items_group_product_unique UNIQUE (group_id, product_id);

-- Create RPC to safely and atomically increment the counted_stock
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
    
    -- Also update the group's last_counted_at safely
    UPDATE public.inventory_groups 
    SET last_counted_at = timezone('utc'::text, now())
    WHERE id = p_group_id;
END;
$$;
