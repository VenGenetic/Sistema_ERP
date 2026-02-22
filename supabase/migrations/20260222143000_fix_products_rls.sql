-- Migration: Add missing INSERT and UPDATE RLS policies for products table
-- Safely drop existing policies first to avoid "already exists" errors

DO $$ 
BEGIN
    -- PRODUCTS
    DROP POLICY IF EXISTS "Allow update access for authenticated users" ON public.products;
    DROP POLICY IF EXISTS "Allow insert access for authenticated users" ON public.products;
    
    -- INVENTORY_LEVELS
    DROP POLICY IF EXISTS "Allow update access for authenticated users" ON public.inventory_levels;
    DROP POLICY IF EXISTS "Allow insert access for authenticated users" ON public.inventory_levels;

    -- WAREHOUSES
    DROP POLICY IF EXISTS "Allow update access for authenticated users" ON public.warehouses;
    DROP POLICY IF EXISTS "Allow insert access for authenticated users" ON public.warehouses;
END $$;

-- Add UPDATE policy for authenticated users
CREATE POLICY "Allow update access for authenticated users"
  ON products
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add INSERT policy for authenticated users
CREATE POLICY "Allow insert access for authenticated users"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also add missing policies for inventory_levels (same issue — only SELECT existed)
CREATE POLICY "Allow update access for authenticated users"
  ON inventory_levels
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow insert access for authenticated users"
  ON inventory_levels
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also ensure warehouses can be managed
CREATE POLICY "Allow update access for authenticated users"
  ON warehouses
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow insert access for authenticated users"
  ON warehouses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
