-- Create a view to easily fetch accounts with their current balance
CREATE OR REPLACE VIEW account_balances AS
SELECT 
    a.id,
    a.code,
    a.name,
    a.category,
    a.is_nominal,
    a.currency,
    a.position,
    a.created_at,
    a.updated_at,
    COALESCE(
        SUM(
            CASE 
                WHEN a.category IN ('asset', 'expense') THEN tl.debit - tl.credit
                ELSE tl.credit - tl.debit
            END
        ), 
        0
    ) AS current_balance
FROM accounts a
LEFT JOIN transaction_lines tl ON a.id = tl.account_id
GROUP BY a.id;
