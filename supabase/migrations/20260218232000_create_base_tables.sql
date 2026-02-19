-- Migration: Create Base Inventory Tables
-- Timestamp: 20260218232000 (Before upgrade migration)

-- 1. Products
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    min_stock_threshold NUMERIC DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('physical', 'digital_partner')),
    location TEXT,
    partner_id INTEGER, -- Optional link to partners table
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Inventory Levels
CREATE TABLE IF NOT EXISTS inventory_levels (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    warehouse_id INTEGER REFERENCES warehouses(id),
    current_stock NUMERIC DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(product_id, warehouse_id)
);

-- 4. Inventory Logs (Base definition, upgrade migration adds columns)
CREATE TABLE IF NOT EXISTS inventory_logs (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    warehouse_id INTEGER REFERENCES warehouses(id),
    quantity_change NUMERIC NOT NULL,
    reason TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;
-- inventory_logs RLS is handled in upgrade migration

-- Basic Policies (Read-only for now for authenticated)
CREATE POLICY "Allow read access for authenticated users" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON inventory_levels FOR SELECT TO authenticated USING (true);

-- SEED DATA (Only if empty)
INSERT INTO warehouses (name, type, location, is_active)
SELECT 'Almacén Central', 'physical', 'Ciudad de México, MX', true
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE name = 'Almacén Central');

INSERT INTO warehouses (name, type, location, is_active)
SELECT 'MegaDrop Logistics', 'digital_partner', 'Shenzhen, CN', true
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE name = 'MegaDrop Logistics');

INSERT INTO products (sku, name, category, min_stock_threshold)
SELECT 'AUD-PRO-BLK', 'Audífonos Pro', 'Electronics', 10
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'AUD-PRO-BLK');

INSERT INTO products (sku, name, category, min_stock_threshold)
SELECT 'SW-V2-SLV', 'Smart Watch V2', 'Electronics', 15
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SW-V2-SLV');

-- Initialize Inventory Levels for Seed Products
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT p.id, w.id, 100
FROM products p, warehouses w
WHERE p.sku = 'AUD-PRO-BLK' AND w.name = 'Almacén Central'
ON CONFLICT DO NOTHING;

INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT p.id, w.id, 50
FROM products p, warehouses w
WHERE p.sku = 'SW-V2-SLV' AND w.name = 'MegaDrop Logistics'
ON CONFLICT DO NOTHING;
