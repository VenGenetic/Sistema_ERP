-- Migration: Sales Phase 1
-- Timestamp: 20260221151941

-- 1. Create CUSTOMERS Table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    identification_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    is_final_consumer BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Alter ORDERS Table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id),
ADD COLUMN IF NOT EXISTS channel TEXT CHECK (channel IN ('POS', 'ONLINE')),
ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'refunded')),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 3. Create LOST_DEMAND Table
CREATE TABLE IF NOT EXISTS lost_demand (
    id SERIAL PRIMARY KEY,
    search_term TEXT NOT NULL,
    product_id INTEGER REFERENCES products(id),
    reason TEXT CHECK (reason IN ('out_of_stock', 'not_in_catalog')),
    channel TEXT CHECK (channel IN ('POS', 'ONLINE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id)
);

-- 4. Enable RLS and Policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_demand ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access for authenticated users to customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access for authenticated users to lost_demand" ON lost_demand FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Seed Default Customer
INSERT INTO customers (identification_number, name, is_final_consumer) 
VALUES ('9999999999', 'CONSUMIDOR FINAL', true) 
ON CONFLICT (identification_number) DO NOTHING;
