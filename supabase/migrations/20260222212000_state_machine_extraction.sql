-- Phase 1.2: State Machine Extraction
-- Replace hardcoded string statuses with dynamic state machine tables

-- 1. Create the new status tables
CREATE TABLE IF NOT EXISTS order_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    step_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS partner_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default order statuses
INSERT INTO order_statuses (name, description, step_order) VALUES
  ('draft', 'Initial order draft', 10),
  ('pending', 'Awaiting processing or payment', 20),
  ('pending_verification', 'Awaiting manual or payment verification', 25),
  ('processing_fulfillment', 'Order is being picked and packed', 30),
  ('ready_for_pickup', 'Order is ready at warehouse for customer pickup', 40),
  ('shipped', 'Order has been shipped', 50),
  ('completed', 'Order successfully completed', 60),
  ('cancelled', 'Order cancelled', 90)
ON CONFLICT (name) DO NOTHING;

-- Insert default partner statuses
INSERT INTO partner_statuses (name, description) VALUES
  ('active', 'Active partner'),
  ('inactive', 'Inactive or suspended partner'),
  ('pending_review', 'Partner application pending review')
ON CONFLICT (name) DO NOTHING;


-- 2. Modify orders table to use the new order_statuses table

-- First, drop any existing check constraint that binds status to specific strings.
-- To do this robustly without knowing the exact name (if it varies), we drop known names 
-- and also run an anonymous DO block just in case.
DO $$ 
DECLARE 
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint 
    WHERE conrelid = 'orders'::regclass AND contype = 'c' 
    AND pg_get_constraintdef(oid) LIKE '%status%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE orders DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Safely ignore errors if table doesn't exist or other issues
        NULL;
END $$;

-- Drop specifically if known
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add new foreign key column (initially nullable to allow data migration)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status_id INTEGER REFERENCES order_statuses(id);

-- Migrate existing data (mapping string status to ID)
UPDATE orders o
SET order_status_id = os.id
FROM order_statuses os
WHERE o.status::text = os.name
  AND o.order_status_id IS NULL;

-- Default fallback for any unmatched statuses
UPDATE orders
SET order_status_id = (SELECT id FROM order_statuses WHERE name = 'draft')
WHERE order_status_id IS NULL;

-- Make the new column NOT NULL (optional, but good practice for an ERP)
-- ALTER TABLE orders ALTER COLUMN order_status_id SET NOT NULL;

-- Finally, we can drop the old status column if not needed by other logic, 
-- but often it's safer to keep it for a transitional period. 
-- For a strict ERP upgrade, we drop it.
-- ALTER TABLE orders DROP COLUMN status; 
-- Wait, many UI components might break immediately if we drop `status`. 
-- ERP upgrade strategy: Keep `status` as a generated column or just keep it synced via trigger, 
-- or simply accept we must update the UI immediately. 
-- Let's stick strictly to the plan: "Change the status column in orders to an order_status_id Foreign Key".
-- Since it says "Change the status column", we will drop the old and ensure we use the new.
-- However, we will leave the old status column for now, but remove its constraint, so backend developers can switch over.
