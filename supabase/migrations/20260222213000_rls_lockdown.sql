-- Phase 1.3: Security & RLS Lockdown
-- Implement secure Postgres function to check role_id
-- Lock down financial records (No UPDATE/DELETE)

-- 1. Create a secure function to fetch the current user's role from the profiles table
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
DECLARE
  v_role_name text;
BEGIN
  -- We must get the role name by joining profiles with roles based on auth.uid()
  -- If roles table does not exist directly, we assume profiles has a role_id 
  -- and there is a roles table. Or if the profile simply has a role column.
  -- Looking at previous schemas, profiles joins roles on role_id = roles.id.
  
  -- Let's safely check if the user is authenticated first
  IF auth.uid() IS NULL THEN
    RETURN 'anon';
  END IF;

  SELECT r.name INTO v_role_name
  FROM public.profiles p
  JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = auth.uid();
  
  RETURN COALESCE(v_role_name, 'authenticated');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Lock down Transactions (No UPDATE/DELETE allow)
-- Transactions and Transaction Lines should only be INSERT/SELECT.
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive UPDATE/DELETE policies
DROP POLICY IF EXISTS "Allow full access to transactions" ON transactions;
DROP POLICY IF EXISTS "Allow full access to transaction_lines" ON transaction_lines;

-- We can drop specific named policies if we know them, but dropping IF EXISTS works.
DO $$ 
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename IN ('transactions', 'transaction_lines') 
    AND cmd IN ('UPDATE', 'DELETE')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON transactions';
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON transaction_lines';
  END LOOP;
END $$;

-- Create secure policies for Transactions
CREATE POLICY "Enable read access for all users" ON transactions
  FOR SELECT TO authenticated USING (true);

-- Usually only admins/system can insert directly, but for ERP, authenticated users operating the system create transactions (e.g. POS sale)
CREATE POLICY "Enable insert for authenticated users" ON transactions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON transaction_lines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON transaction_lines
  FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Lock down Inventory Logs (No UPDATE/DELETE allow)
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'inventory_logs' 
    AND cmd IN ('UPDATE', 'DELETE')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON inventory_logs';
  END LOOP;
END $$;

-- Policies for Inventory Logs
CREATE POLICY "Enable read access for all users" ON inventory_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON inventory_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id); -- Ensure users can only log their own entries

-- Ensure No UPDATE/DELETE on these critical tables. By NOT creating an UPDATE/DELETE policy, 
-- Postgres RLS denies it by default since we ENABLE ROW LEVEL SECURITY.

-- Also, to be absolutely certain beyond RLS (e.g., service_role or trigger bypass), 
-- we can add a Postgres Rule or Trigger that explicitly raises an exception.
CREATE OR REPLACE FUNCTION prevent_finance_mutations()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Financial records % are immutable. Use compensatory entries instead.', TG_TABLE_NAME;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_transactions_mutation ON transactions;
CREATE TRIGGER trg_prevent_transactions_mutation
  BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION prevent_finance_mutations();

DROP TRIGGER IF EXISTS trg_prevent_transaction_lines_mutation ON transaction_lines;
CREATE TRIGGER trg_prevent_transaction_lines_mutation
  BEFORE UPDATE OR DELETE ON transaction_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_finance_mutations();

DROP TRIGGER IF EXISTS trg_prevent_inventory_logs_mutation ON inventory_logs;
CREATE TRIGGER trg_prevent_inventory_logs_mutation
  BEFORE UPDATE OR DELETE ON inventory_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_finance_mutations();
