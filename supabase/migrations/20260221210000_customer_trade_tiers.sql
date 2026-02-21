-- Migration: Phase 4 Customer Trade Tiers
-- Timestamp: 20260221210000

-- 1. Add columns to customers
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'retail' CHECK (customer_type IN ('retail', 'mechanic', 'trade')),
ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100);

-- 2. Ensure Consumidor Final stays retail
UPDATE customers 
SET customer_type = 'retail', discount_percentage = 0 
WHERE identification_number = '9999999999';
