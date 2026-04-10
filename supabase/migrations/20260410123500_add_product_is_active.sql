-- Add is_active column to products for soft-delete support
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing records to be active if they don't have the column yet (IF NOT EXISTS handles column, but just in case)
UPDATE products SET is_active = true WHERE is_active IS NULL;
