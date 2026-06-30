-- Migration: Add is_discontinued and update status checks for demands/requests
-- Timestamp: 20260630090000

-- 1. Alter products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_discontinued BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discontinued_until TIMESTAMP WITH TIME ZONE DEFAULT null;

UPDATE public.products SET is_discontinued = false WHERE is_discontinued IS NULL;

-- 2. Alter product_demands constraints
ALTER TABLE public.product_demands DROP CONSTRAINT IF EXISTS product_demands_status_check;
ALTER TABLE public.product_demands ADD CONSTRAINT product_demands_status_check 
  CHECK (status IN ('pending_stock', 'stock_available', 'notified', 'cancelled', 'discontinued'));

-- 3. Alter customer_requests constraints
ALTER TABLE public.customer_requests DROP CONSTRAINT IF EXISTS customer_requests_status_check;
ALTER TABLE public.customer_requests ADD CONSTRAINT customer_requests_status_check 
  CHECK (status IN ('pending', 'arrived', 'notified', 'completed', 'cancelled', 'discontinued'));
