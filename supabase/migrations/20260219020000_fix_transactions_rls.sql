-- Fix RLS policy violation for transactions
-- 1. Redefine create_transaction_v1 with SECURITY DEFINER to bypass RLS on INSERTs
-- 2. Ensure RLS policies are correctly set for authenticated users

-- Update RPC to be SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_transaction_v1(
  p_description text,
  p_reference_type text,
  p_order_id int,
  p_lines jsonb
) RETURNS int
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id int;
  v_line jsonb;
  v_line_record record; -- Use record for loop iteration
  v_debit_sum numeric := 0;
  v_credit_sum numeric := 0;
  v_account_id int;
  v_debit numeric;
  v_credit numeric;
BEGIN
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate that there are lines
  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Transaction must have at least one line';
  END IF;

  -- Insert transaction
  INSERT INTO transactions (description, reference_type, order_id)
  VALUES (p_description, p_reference_type, p_order_id)
  RETURNING id INTO v_transaction_id;

  -- Process lines
  -- Iterate using a record variable
  FOR v_line_record IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line := v_line_record.value;
    
    v_account_id := (v_line->>'account_id')::int;
    v_debit := COALESCE((v_line->>'debit')::numeric, 0);
    v_credit := COALESCE((v_line->>'credit')::numeric, 0);

    -- Insert line
    INSERT INTO transaction_lines (transaction_id, account_id, debit, credit)
    VALUES (v_transaction_id, v_account_id, v_debit, v_credit);
    
    v_debit_sum := v_debit_sum + v_debit;
    v_credit_sum := v_credit_sum + v_credit;
  END LOOP;

  -- Consistency check: Double-entry bookkeeping must balance
  IF ABS(v_debit_sum - v_credit_sum) > 0.001 THEN
    RAISE EXCEPTION 'Transaction sums do not balance: debit % != credit %', v_debit_sum, v_credit_sum;
  END IF;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Ensure RLS policies exist and are correct for transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON transactions;
CREATE POLICY "Enable all for authenticated users" 
ON transactions 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Ensure RLS policies exist and are correct for transaction_lines
ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON transaction_lines;
CREATE POLICY "Enable all for authenticated users" 
ON transaction_lines 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
