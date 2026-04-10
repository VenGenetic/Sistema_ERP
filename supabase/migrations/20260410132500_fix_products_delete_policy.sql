-- Fix: Allow deletion of products for authenticated users
DROP POLICY IF EXISTS "Allow delete access for authenticated users" ON public.products;
CREATE POLICY "Allow delete access for authenticated users"
  ON products
  FOR DELETE
  TO authenticated
  USING (true);

-- Extra safety: Ensure all products have is_active set to true if NULL
-- (This ensures the .eq('is_active', true) filter doesn't hide products by mistake)
UPDATE products SET is_active = true WHERE is_active IS NULL;
