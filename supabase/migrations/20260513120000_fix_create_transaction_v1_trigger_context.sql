-- Migration: Fix create_transaction_v1 to work from trigger context
-- Timestamp: 20260513120000
-- Problem: The auth.uid() IS NULL check blocks the function when called
-- from within a trigger (process_order_financial_transaction), because
-- triggers run outside of the user session context. This caused the
-- shipping_expense transaction (second create_transaction_v1 call) to
-- silently fail, resulting in no deduction from the shipping expense account.
-- Fix: Remove the auth.uid() guard. The function is SECURITY DEFINER,
-- so it already runs with elevated privileges. The trigger itself is 
-- only reachable via process_pos_sale (SECURITY DEFINER), which is
-- already protected by Supabase's RPC authentication.

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
  v_line_record record;
  v_debit_sum numeric := 0;
  v_credit_sum numeric := 0;
  v_account_id int;
  v_debit numeric;
  v_credit numeric;
BEGIN
  -- Validate that there are lines
  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Transaction must have at least one line';
  END IF;

  -- Insert transaction
  INSERT INTO transactions (description, reference_type, order_id)
  VALUES (p_description, p_reference_type, p_order_id)
  RETURNING id INTO v_transaction_id;

  -- Process lines
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
