-- 1. Preparar la tabla Products para aceptar "Borradores"
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('active', 'draft', 'discontinued')) DEFAULT 'active';

-- 2. Actualizar Order Items (El motor del Split Fulfillment)
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('in_stock', 'pending_sourcing', 'sourced', 'rejected', 'shipped', 'cancelled')) DEFAULT 'in_stock';
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS fulfilled_quantity NUMERIC DEFAULT 0;

-- 3. Ampliar los estados permitidos en la tabla Orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('draft', 'quote_sent', 'awaiting_deposit', 'processing', 'partially_fulfilled', 'completed', 'cancelled', 'lost'));

-- 4. Insertar Cuenta Puente de Anticipos si no existe
INSERT INTO accounts (code, name, category, is_nominal, currency, position)
SELECT '2020', 'Anticipos de Clientes', 'liability', false, 'USD', 100
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '2020' OR name = 'Anticipos de Clientes')
ON CONFLICT (code) DO NOTHING;

-- 5. Crear el Trigger Automático (Mágia del ERP)
-- Esto actualiza el estado de la Orden Padre basado en sus Items Hijos
CREATE OR REPLACE FUNCTION update_parent_order_status()
RETURNS TRIGGER AS $$
DECLARE
    total_valid_items INT;
    shipped_items INT;
BEGIN
    SELECT COUNT(*) INTO total_valid_items FROM order_items 
    WHERE order_id = NEW.order_id AND status NOT IN ('rejected', 'cancelled');

    SELECT COUNT(*) INTO shipped_items FROM order_items 
    WHERE order_id = NEW.order_id AND status = 'shipped';

    IF total_valid_items = 0 THEN
        -- Si no hay items válidos (todos rechazados o cancelados), la orden se cancela
        UPDATE orders SET status = 'cancelled' WHERE id = NEW.order_id;
    ELSIF shipped_items = 0 THEN
        -- Aún en proceso o esperando despacho
        NULL;
    ELSIF shipped_items < total_valid_items THEN
        UPDATE orders SET status = 'partially_fulfilled' WHERE id = NEW.order_id;
    ELSIF shipped_items = total_valid_items AND total_valid_items > 0 THEN
        UPDATE orders SET status = 'completed' WHERE id = NEW.order_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_order_status ON order_items;
CREATE TRIGGER trigger_update_order_status
AFTER UPDATE OF status ON order_items
FOR EACH ROW EXECUTE FUNCTION update_parent_order_status();
