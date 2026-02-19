-- Create "Balances iniciales" account
-- Using code 3000 for Equity
-- Position 40 to follow existing assets
INSERT INTO accounts (code, name, category, is_nominal, currency, position)
VALUES ('3000', 'Balances iniciales', 'equity', false, 'USD', 40)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    is_nominal = EXCLUDED.is_nominal,
    currency = EXCLUDED.currency,
    position = EXCLUDED.position;
