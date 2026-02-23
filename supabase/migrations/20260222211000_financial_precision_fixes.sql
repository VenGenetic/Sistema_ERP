-- Phase 1.1: Financial Precision Fixes (SAFE)
-- This migration standardizes existing financial and quantity columns to NUMERIC(15,4)
-- to prevent rounding errors and ensure data integrity in complex calculations.

-- We use DO blocks to safely alter columns ONLY if they exist to prevent migration crashes.

DO $$ 
BEGIN

    -- 1. Products
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='min_stock_threshold') THEN
        ALTER TABLE products ALTER COLUMN min_stock_threshold TYPE NUMERIC(15,4);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price') THEN
        ALTER TABLE products ALTER COLUMN price TYPE NUMERIC(15,4);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='cost_without_vat') THEN
        ALTER TABLE products ALTER COLUMN cost_without_vat TYPE NUMERIC(15,4);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='profit_margin') THEN
        ALTER TABLE products ALTER COLUMN profit_margin TYPE NUMERIC(15,4);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='vat_percentage') THEN
        ALTER TABLE products ALTER COLUMN vat_percentage TYPE NUMERIC(15,4);
    END IF;


    -- 2. Product Entries History
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_entries_history' AND column_name='cost_without_vat') THEN
        ALTER TABLE product_entries_history ALTER COLUMN cost_without_vat TYPE NUMERIC(15,4);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_entries_history' AND column_name='discounted_cost') THEN
        ALTER TABLE product_entries_history ALTER COLUMN discounted_cost TYPE NUMERIC(15,4);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_entries_history' AND column_name='discount_percentage') THEN
        ALTER TABLE product_entries_history ALTER COLUMN discount_percentage TYPE NUMERIC(15,4);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_entries_history' AND column_name='vat_percentage') THEN
        ALTER TABLE product_entries_history ALTER COLUMN vat_percentage TYPE NUMERIC(15,4);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_entries_history' AND column_name='final_cost_with_vat') THEN
        ALTER TABLE product_entries_history ALTER COLUMN final_cost_with_vat TYPE NUMERIC(15,4);
    END IF;


    -- 3. Inventory
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_levels' AND column_name='current_stock') THEN
        ALTER TABLE inventory_levels ALTER COLUMN current_stock TYPE NUMERIC(15,4);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_logs' AND column_name='quantity_change') THEN
        ALTER TABLE inventory_logs ALTER COLUMN quantity_change TYPE NUMERIC(15,4);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_transfers' AND column_name='quantity') THEN
        ALTER TABLE inventory_transfers ALTER COLUMN quantity TYPE NUMERIC(15,4);
    END IF;


    -- 4. Orders and Order Items
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_amount') THEN
        ALTER TABLE orders ALTER COLUMN total_amount TYPE NUMERIC(15,4);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='shipping_cost') THEN
        ALTER TABLE orders ALTER COLUMN shipping_cost TYPE NUMERIC(15,4);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_cost') THEN
        ALTER TABLE orders ALTER COLUMN total_cost TYPE NUMERIC(15,4);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='quantity') THEN
        ALTER TABLE order_items ALTER COLUMN quantity TYPE NUMERIC(15,4);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='unit_price') THEN
        ALTER TABLE order_items ALTER COLUMN unit_price TYPE NUMERIC(15,4);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='unit_cost') THEN
        ALTER TABLE order_items ALTER COLUMN unit_cost TYPE NUMERIC(15,4);
    END IF;


    -- 5. Transactions and Ledger
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transaction_lines' AND column_name='debit') THEN
        ALTER TABLE transaction_lines ALTER COLUMN debit TYPE NUMERIC(15,4);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transaction_lines' AND column_name='credit') THEN
        ALTER TABLE transaction_lines ALTER COLUMN credit TYPE NUMERIC(15,4);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='opening_balance') THEN
        ALTER TABLE accounts ALTER COLUMN opening_balance TYPE NUMERIC(15,4);
    END IF;


    -- 6. Customers and Settings
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_trade_tiers' AND column_name='discount_percentage') THEN
        ALTER TABLE customer_trade_tiers ALTER COLUMN discount_percentage TYPE NUMERIC(15,4);
    END IF;

END $$;
