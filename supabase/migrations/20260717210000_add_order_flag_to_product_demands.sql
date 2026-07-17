-- Migration: Add order_flag to Product Demands
-- Timestamp: 20260717210000

ALTER TABLE public.product_demands
ADD COLUMN IF NOT EXISTS order_flag TEXT DEFAULT NULL;
