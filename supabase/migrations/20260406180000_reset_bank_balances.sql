-- Reset de cuentas bancarias a 0 (Ajuste de Inicio) usando la tabla nativa "transaction_lines"
DO $$ 
DECLARE 
    v_transaction_id INTEGER;
    v_account_id INTEGER;
    v_account_name TEXT;
    v_balance NUMERIC;
    v_equity_account_id INTEGER;
BEGIN
    -- Asegurar que existe una cuenta de Capital para cuadrar la partida doble
    SELECT id INTO v_equity_account_id
    FROM accounts WHERE name ILIKE 'Ajuste de Capital Inicial' LIMIT 1;

    IF v_equity_account_id IS NULL THEN
        INSERT INTO accounts (code, name, category, is_nominal, currency, position)
        VALUES ('3-3001', 'Ajuste de Capital Inicial', 'equity', false, 'USD', 99)
        RETURNING id INTO v_equity_account_id;
    END IF;

    -- Consultamos el balance actual utilizando la vista oficial de tu base de datos
    FOR v_account_id, v_account_name, v_balance IN
        SELECT a.id, a.name, v.current_balance
        FROM accounts a
        JOIN account_balances v ON a.id = v.id
        WHERE a.category IN ('asset') AND v.current_balance <> 0
    LOOP
        -- Creamos la transacción financiera (eliminado transaction_date, usado reference_type)
        INSERT INTO transactions (description, reference_type)
        VALUES ('Reinicio a 0 (Empezar desde hoy): ' || v_account_name, 'adjustment')
        RETURNING id INTO v_transaction_id;

        -- En cuentas "asset" (Activo), el saldo natural es Deudor.
        -- Para reducir un activo positivo, lo Acreditamos (credit).
        IF v_balance > 0 THEN
            INSERT INTO transaction_lines (transaction_id, account_id, credit, debit)
            VALUES (v_transaction_id, v_account_id, v_balance, 0);   -- Acredita el Banco (reduce a 0)
            
            INSERT INTO transaction_lines (transaction_id, account_id, credit, debit)
            VALUES (v_transaction_id, v_equity_account_id, 0, v_balance); -- Debita Patrimonio
        ELSE
            -- Si quedó en negativo, lo Debitamos para subirlo a 0.
            INSERT INTO transaction_lines (transaction_id, account_id, credit, debit)
            VALUES (v_transaction_id, v_account_id, 0, abs(v_balance)); -- Debita el Banco (sube a 0)
            
            INSERT INTO transaction_lines (transaction_id, account_id, credit, debit)
            VALUES (v_transaction_id, v_equity_account_id, abs(v_balance), 0); -- Acredita Patrimonio
        END IF;

    END LOOP;
END $$;
