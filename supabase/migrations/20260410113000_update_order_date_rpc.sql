-- Migration: Add secure function to update order date (created_at)
-- This function bypasses RLS for the specific purpose of backdating orders in Daily Registry
-- Timestamp: 20260410113000

CREATE OR REPLACE FUNCTION update_order_date(
    p_order_id INTEGER,
    p_new_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- This allows it to bypass RLS policies on the 'orders' table
AS $$
BEGIN
    -- 1. Security check: Only authenticated users
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Performance the update
    UPDATE public.orders
    SET created_at = p_new_date
    WHERE id = p_order_id;

    -- 3. Check if any row was actually updated
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Pedido no encontrado');
    END IF;

    RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$;
