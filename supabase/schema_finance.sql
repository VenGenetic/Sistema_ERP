
-- Create ACCOUNTS table
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('asset', 'liability', 'equity', 'income', 'expense')),
    is_nominal BOOLEAN DEFAULT false,
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create TRANSACTIONS table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    reference_type VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create TRANSACTION_LINES table
CREATE TABLE IF NOT EXISTS transaction_lines (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES accounts(id),
    debit NUMERIC(15, 2) DEFAULT 0,
    credit NUMERIC(15, 2) DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;

-- Create policies (Allow all for authenticated users for now, can be refined later)
CREATE POLICY "Enable all for authenticated users" ON accounts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON transaction_lines FOR ALL USING (auth.role() = 'authenticated');

-- Insert default accounts (Chart of Accounts)
INSERT INTO accounts (code, name, category, is_nominal, currency) VALUES
('1001', 'Caja General', 'asset', false, 'USD'),
('1002', 'Banco Stripe', 'asset', false, 'USD'),
('1003', 'Banco Central', 'asset', false, 'USD'),
('4001', 'Ingresos por Ventas', 'income', true, 'USD'),
('5001', 'Costos de Ventas', 'expense', true, 'USD'),
('5100', 'Gastos Operativos', 'expense', true, 'USD')
ON CONFLICT (code) DO NOTHING;
