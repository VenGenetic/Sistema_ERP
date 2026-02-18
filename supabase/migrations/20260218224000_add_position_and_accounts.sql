-- Add position column to accounts table
ALTER TABLE accounts ADD COLUMN output_order INTEGER DEFAULT 0;

-- Rename it to position if preferred, but usually straightforward names are better. 
-- Let's stick to 'position' as per plan, but 'order' is a reserved word so 'position' or 'sort_order' is better.
-- Using 'position' as planned.
ALTER TABLE accounts DROP COLUMN IF EXISTS output_order; -- Cleanup just in case
ALTER TABLE accounts ADD COLUMN position INTEGER DEFAULT 0;

-- Insert new accounts
INSERT INTO accounts (code, name, category, is_nominal, currency, position) VALUES
('1010', 'Caja Chica', 'asset', false, 'USD', 10),
('1011', 'Caja Grande', 'asset', false, 'USD', 20),
('1012', 'Banco del Pacífico', 'asset', false, 'USD', 30)
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    is_nominal = EXCLUDED.is_nominal,
    currency = EXCLUDED.currency;

-- Update existing accounts with some default positions to ensure consistency
UPDATE accounts SET position = 1 WHERE code = '1001'; -- Caja General
UPDATE accounts SET position = 2 WHERE code = '1002'; -- Banco Stripe
UPDATE accounts SET position = 3 WHERE code = '1003'; -- Banco Central
