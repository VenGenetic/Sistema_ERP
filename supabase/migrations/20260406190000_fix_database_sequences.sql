-- Script para reparar y sincronizar automáticamente las secuencias de las tablas (Auto-incrementables)
-- Esto soluciona errores de "llave duplicada" o problemas al generar el número de la orden / transacción.

DO $$
BEGIN
    -- Sincronizar ID de orders
    PERFORM setval(pg_get_serial_sequence('orders', 'id'), coalesce(max(id), 0) + 1, false) FROM orders;
    
    -- Sincronizar ID de order_items
    PERFORM setval(pg_get_serial_sequence('order_items', 'id'), coalesce(max(id), 0) + 1, false) FROM order_items;
    
    -- Sincronizar ID de transactions
    PERFORM setval(pg_get_serial_sequence('transactions', 'id'), coalesce(max(id), 0) + 1, false) FROM transactions;
    
    -- Sincronizar ID de transaction_lines
    PERFORM setval(pg_get_serial_sequence('transaction_lines', 'id'), coalesce(max(id), 0) + 1, false) FROM transaction_lines;
    
    -- Sincronizar ID de inventory_logs
    PERFORM setval(pg_get_serial_sequence('inventory_logs', 'id'), coalesce(max(id), 0) + 1, false) FROM inventory_logs;
    
    -- Sincronizar ID de products (por si probaron productos)
    PERFORM setval(pg_get_serial_sequence('products', 'id'), coalesce(max(id), 0) + 1, false) FROM products;
    
END $$;
