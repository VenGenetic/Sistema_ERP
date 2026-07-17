-- Migration: Add approved_by and approved_at to product_demands
-- Timestamp: 20260717202700

ALTER TABLE public.product_demands
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
