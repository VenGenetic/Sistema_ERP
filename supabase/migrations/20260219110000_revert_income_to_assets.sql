-- Migration: Restore Bank and Cash accounts to 'income' category
-- The user reported these accounts are showing as 'expense', which is incorrect.
-- This script explicitly targets these accounts and sets them to 'income'.
-- As requested, we drop the constraint that prevents 'income' as a value.

-- 1. Remove the constraint "accounts_category_check"
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_category_check;

-- 2. Update specific Bank and Cash accounts to 'income'
UPDATE accounts
SET category = 'income'
WHERE name IN (
    'B. Guayaquil', 
    'B. Pichincha', 
    'Caja Chica', 
    'Caja Grande', 
    'B. Pacífico'
);

-- Note: We are NOT re-adding the constraint because 'income' might not be in the original allowed list (likely 'revenue').
-- Leaving it off as requested ("elimina ese constraint estúpido").
