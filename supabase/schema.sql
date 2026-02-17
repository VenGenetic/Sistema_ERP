-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================= Módulo de Usuarios =================
CREATE TABLE public.roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, -- "admin", "closer", "onsite", "dev"
    permissions JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    role_id INTEGER REFERENCES public.roles(id)
);

-- ================= Módulo de Partners y Almacenes =================
CREATE TABLE public.partners (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('supplier', 'reseller')),
    status TEXT DEFAULT 'active'
);

CREATE TABLE public.warehouses (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('physical', 'digital_partner')),
    location TEXT,
    partner_id INTEGER REFERENCES public.partners(id) ON DELETE SET NULL, -- Opcional, solo para warehouses digitales
    is_active BOOLEAN DEFAULT true
);

-- ================= Módulo de Inventario =================
CREATE TABLE public.products (
    id SERIAL PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT,
    min_stock_threshold INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.inventory_levels (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
    warehouse_id INTEGER REFERENCES public.warehouses(id) ON DELETE CASCADE,
    current_stock INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, warehouse_id)
);

CREATE TABLE public.inventory_logs (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
    warehouse_id INTEGER REFERENCES public.warehouses(id) ON DELETE CASCADE,
    quantity_change INTEGER NOT NULL,
    reason TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================= Módulo de Ventas (Órdenes) =================
CREATE TABLE public.orders (
    id SERIAL PRIMARY KEY,
    partner_id INTEGER REFERENCES public.partners(id),
    warehouse_id INTEGER REFERENCES public.warehouses(id),
    status TEXT DEFAULT 'pending', -- pending, processing, shipped, delivered, cancelled
    total_amount DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES public.products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL
);

-- ================= Módulo Financiero (Partida Doble) =================
CREATE TABLE public.accounts (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE, -- 1001, 2001, etc.
    name TEXT NOT NULL,
    category TEXT CHECK (category IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    is_nominal BOOLEAN DEFAULT false,
    currency TEXT DEFAULT 'USD'
);

CREATE TABLE public.transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES public.orders(id) ON DELETE SET NULL,
    reference_type TEXT, -- sale, refund, purchase, laundry, manual_journal
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.transaction_lines (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES public.transactions(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES public.accounts(id),
    debit DECIMAL(12, 2) DEFAULT 0.00,
    credit DECIMAL(12, 2) DEFAULT 0.00
);

-- ================= RLS (Row Level Security) Helper =================
-- Enable RLS on all tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_lines ENABLE ROW LEVEL SECURITY;

-- Create policies (Basic 'read all' for authenticated users for now, can be restricted later)
CREATE POLICY "Allow read access for authenticated users" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.inventory_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.inventory_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.transaction_lines FOR SELECT TO authenticated USING (true);

-- Insert Default Roles
INSERT INTO public.roles (name, permissions) VALUES 
('admin', '{"all": true}'),
('closer', '{"sales": true, "inventory": "read"}'),
('onsite', '{"inventory": "write", "sales": "read"}'),
('dev', '{"settings": true}');

-- Insert Default Accounts (Chart of Accounts partial)
INSERT INTO public.accounts (code, name, category, is_nominal) VALUES
('1001', 'Caja General', 'asset', false),
('1002', 'Banco Central', 'asset', false),
('2001', 'Cuentas por Pagar', 'liability', false),
('4001', 'Ventas de Productos', 'revenue', true),
('5001', 'Costo de Ventas', 'expense', true);
