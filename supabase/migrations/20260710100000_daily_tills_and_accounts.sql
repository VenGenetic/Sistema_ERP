-- 1. Create daily_tills table
CREATE TABLE IF NOT EXISTS daily_tills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE UNIQUE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'America/Guayaquil'),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    initial_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    final_expected_cash NUMERIC(12, 2),
    final_actual_cash NUMERIC(12, 2),
    notes TEXT,
    opened_by UUID REFERENCES auth.users(id),
    closed_by UUID REFERENCES auth.users(id),
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on daily_tills
ALTER TABLE daily_tills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read access to daily_tills" ON daily_tills FOR SELECT USING (true);
CREATE POLICY "Allow insert access to daily_tills" ON daily_tills FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update access to daily_tills" ON daily_tills FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow delete access to daily_tills" ON daily_tills FOR DELETE USING (auth.role() = 'authenticated');

-- 2. Consolidate accounts to ID 24
-- Ensure account 24 exists (in case the ID was changed or something weird happened)
INSERT INTO accounts (id, code, name, type, description, position)
VALUES (24, '1-1004', 'Efectivo en Tienda', 'asset', 'Efectivo en Tienda Central', 4)
ON CONFLICT (id) DO NOTHING;

-- Update all references in the system to point to 24
UPDATE public.transaction_lines
SET account_id = 24 WHERE payment_account_id IS NOT NULL;
UPDATE orders SET shipping_expense_account_id = 24 WHERE shipping_expense_account_id IS NOT NULL;

-- Delete all other accounts
DELETE FROM accounts WHERE id != 24;

-- Also reset the sequence just in case
SELECT setval('accounts_id_seq', (SELECT MAX(id) FROM accounts));
