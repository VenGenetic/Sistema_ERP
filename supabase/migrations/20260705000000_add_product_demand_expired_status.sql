-- Migration: Add expired status to product demands
-- Timestamp: 20260705000000

ALTER TABLE public.product_demands DROP CONSTRAINT IF EXISTS product_demands_status_check;
ALTER TABLE public.product_demands ADD CONSTRAINT product_demands_status_check 
  CHECK (status IN ('pending_stock', 'stock_available', 'notified', 'cancelled', 'discontinued', 'expired'));
