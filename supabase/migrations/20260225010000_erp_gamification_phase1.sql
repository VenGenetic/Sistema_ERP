-- Migration: ERP Gamification & Workflow Phase 1
-- Description: Transition to line-level pipeline and point ledger tables
-- Timestamp: 20260225010000

-- ==========================================
-- 1. Modify public.products
-- ==========================================
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'official' CHECK (status IN ('draft', 'official', 'rejected')),
ADD COLUMN IF NOT EXISTS demand_count integer DEFAULT 0;

-- Update existing null products to 'official'
UPDATE public.products SET status = 'official' WHERE status IS NULL;

-- ==========================================
-- 2. Modify public.orders
-- ==========================================
-- Default existing invalid statuses we might have added manually
UPDATE public.orders 
SET status = 'pending_verification' 
WHERE status NOT IN (
  'draft', 
  'quote',
  'pending_verification', 
  'processing_fulfillment', 
  'ready_for_pickup', 
  'shipped', 
  'completed', 
  'cancelled',
  'lost'
);

ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN (
  'draft',
  'quote',
  'pending_verification',
  'processing_fulfillment',
  'ready_for_pickup',
  'shipped',
  'completed',
  'cancelled',
  'lost'
));

-- ==========================================
-- 3. Modify public.order_items
-- ==========================================
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' 
  CHECK (status IN ('pending', 'in_stock', 'sourcing', 'dropshipped', 'delivered', 'backorder', 'rejected')),
ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT false;

-- Clean up existing order_items
UPDATE public.order_items SET status = 'pending' WHERE status IS NULL;
UPDATE public.order_items SET is_paid = false WHERE is_paid IS NULL;

-- ==========================================
-- 4. Create public.point_ledger
-- ==========================================
CREATE TABLE IF NOT EXISTS public.point_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_item_id integer REFERENCES public.order_items(id) ON DELETE CASCADE,
    milestone text NOT NULL CHECK (milestone IN ('M1_Sales', 'M2_Sourcing', 'M3_Data', 'M4_Finance', 'Clawback')),
    points numeric NOT NULL,
    status text DEFAULT 'frozen' CHECK (status IN ('frozen', 'released', 'clawback')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 5. Create public.global_pool
-- ==========================================
CREATE TABLE IF NOT EXISTS public.global_pool (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    month_year date NOT NULL UNIQUE,  -- e.g., '2026-02-01'
    total_pool_amount numeric DEFAULT 0.00,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Index for fast lookup by month
CREATE INDEX IF NOT EXISTS idx_global_pool_month ON public.global_pool (month_year);

-- Index for point ledger filtering
CREATE INDEX IF NOT EXISTS idx_point_ledger_user ON public.point_ledger (user_id);
CREATE INDEX IF NOT EXISTS idx_point_ledger_status ON public.point_ledger (status);

-- Enable RLS for new tables
ALTER TABLE public.point_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_pool ENABLE ROW LEVEL SECURITY;

-- Note: Policies will be added in a separate permissions/RLS script if necessary.
-- Basic admin policy for now
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'point_ledger' AND policyname = 'Admins can manage point ledger'
    ) THEN
        CREATE POLICY "Admins can manage point ledger" ON public.point_ledger
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles p
                JOIN public.roles r ON p.role_id = r.id
                WHERE p.id = auth.uid() AND r.name IN ('admin', 'dev', 'Contador / Finanzas')
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'global_pool' AND policyname = 'Admins can manage global pool'
    ) THEN
        CREATE POLICY "Admins can manage global pool" ON public.global_pool
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles p
                JOIN public.roles r ON p.role_id = r.id
                WHERE p.id = auth.uid() AND r.name IN ('admin', 'dev', 'Contador / Finanzas')
            )
        );
    END IF;
END $$;
