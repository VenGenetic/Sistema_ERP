-- Migration: Phase 1 Database Realignment
-- Description: Creates customers, lost_demand, product_compatibilities tables and adds price to products.

-- 1. Create Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    document_id TEXT UNIQUE, -- e.g., RUC or Cedula
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access for authenticated users" ON customers FOR ALL TO authenticated USING (true);


-- 2. Create Lost Demand Table
CREATE TABLE IF NOT EXISTS lost_demand (
    id SERIAL PRIMARY KEY,
    search_query TEXT,
    product_requested TEXT NOT NULL,
    customer_name TEXT,
    customer_contact TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id)
);

ALTER TABLE lost_demand ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access for authenticated users" ON lost_demand FOR ALL TO authenticated USING (true);


-- 3. Create Product Compatibilities Table (Fitment)
CREATE TABLE IF NOT EXISTS product_compatibilities (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year_from INTEGER NOT NULL,
    year_to INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(product_id, make, model, year_from, year_to)
);

ALTER TABLE product_compatibilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access for authenticated users" ON product_compatibilities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert access for authenticated users" ON product_compatibilities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update access for authenticated users" ON product_compatibilities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete access for authenticated users" ON product_compatibilities FOR DELETE TO authenticated USING (true);

-- 4. Alter Products Table
ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0;

-- Optional: For the columns that already exist but the user requested, we can ensure they are there.
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_without_vat NUMERIC(10,4) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_percentage NUMERIC(5,2) DEFAULT 12.0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS profit_margin NUMERIC(5,4) DEFAULT 0.30;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id BIGINT REFERENCES brands(id);
