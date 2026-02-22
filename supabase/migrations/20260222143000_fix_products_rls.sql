-- Migration: Add missing INSERT and UPDATE RLS policies for products table
-- The products table had RLS enabled since 20260218232000 but only had a SELECT policy.
-- This caused all direct UPDATE and INSERT operations from the frontend to silently fail.

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
