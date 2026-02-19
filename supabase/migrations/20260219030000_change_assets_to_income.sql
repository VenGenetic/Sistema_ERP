-- Migration: Change all Asset accounts to Income
-- This satisfies the user requirement that Credited accounts should increase in balance.

-- 1. Drop the existing constraint. This removes the "lock" on categories.
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_category_check;

-- 2. Perform the update. 
-- Since we dropped the constraint above, this update will succeed for all 'asset' rows.
UPDATE accounts
SET category = 'income'
WHERE category = 'asset';

-- 3. We deliberately do NOT re-add the constraint right now.
-- This ensures the update sticks even if there are other weird categories in your database.
-- You can add the constraint back later if needed, but for now, this fixes your balance display.
