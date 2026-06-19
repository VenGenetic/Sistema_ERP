-- Migration: Create Product Demands (Waitlist)
-- Timestamp: 20260619160000

CREATE TABLE IF NOT EXISTS public.product_demands (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    customer_name TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending_stock' CHECK (status IN ('pending_stock', 'stock_available', 'notified', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    stock_detected_at TIMESTAMP WITH TIME ZONE,
    notified_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index to enforce that the same phone number can only have ONE active request per product
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_product_demand 
ON public.product_demands (phone_number, product_id) 
WHERE (status IN ('pending_stock', 'stock_available'));

-- Enable Row Level Security
ALTER TABLE public.product_demands ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
DROP POLICY IF EXISTS "Allow all operations for authenticated users on product_demands" ON public.product_demands;
CREATE POLICY "Allow all operations for authenticated users on product_demands" 
ON public.product_demands
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger function to detect stock arrival
CREATE OR REPLACE FUNCTION trg_check_demand_stock_arrival()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if stock became available in either local or importer
    IF ((OLD.importer_stock IS NULL OR OLD.importer_stock = 0) AND NEW.importer_stock > 0) OR
       ((OLD.local_stock IS NULL OR OLD.local_stock = 0) AND NEW.local_stock > 0) THEN
        
        UPDATE public.product_demands
        SET status = 'stock_available',
            stock_detected_at = TIMEZONE('utc'::text, NOW()),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE product_id = NEW.id AND status = 'pending_stock';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to execute on product stock updates
DROP TRIGGER IF EXISTS trg_products_stock_arrival ON public.products;
CREATE TRIGGER trg_products_stock_arrival
AFTER UPDATE OF importer_stock, local_stock ON public.products
FOR EACH ROW
EXECUTE FUNCTION trg_check_demand_stock_arrival();
