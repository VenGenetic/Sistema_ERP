-- Migración para inicializar las posiciones de las cuentas existentes
-- Esto asegura que el orden en Finanzas sea determinista de base.

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) - 1 AS new_position
  FROM accounts
  WHERE is_nominal = false
)
UPDATE accounts
SET position = ranked.new_position
FROM ranked
WHERE accounts.id = ranked.id;
