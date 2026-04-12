-- Migration: Allow Reusing SKUs for Deleted Products
-- Description: Drops the strict unique constraint on SKUs and creates a partial unique index so that only *active* products must have unique SKUs.

-- 1. Drop the original unique constraint. (PostgreSQL usually names it table_column_key by default)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;

-- 2. Create a partial unique index that only applies to active products.
-- This allows multiple soft-deleted products to have the same SKU, but only ONE active product can have it.
CREATE UNIQUE INDEX IF NOT EXISTS products_active_sku_idx ON products (sku) WHERE is_active = true;
