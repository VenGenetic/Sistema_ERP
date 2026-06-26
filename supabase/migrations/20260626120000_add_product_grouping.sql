-- Migration to add group_id to products for bidirectional linking of equivalent products

-- 1. Add group_id column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS group_id UUID;

-- 2. Create an index on group_id for O(1) group retrievals
CREATE INDEX IF NOT EXISTS idx_products_group_id ON public.products (group_id);

-- 3. Add a comment explaining the column's purpose
COMMENT ON COLUMN public.products.group_id IS 'UUID used to link equivalent parts. Products with the same group_id are considered bidirectionally linked substitutes.';
