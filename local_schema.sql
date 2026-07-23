 
-- Migration: Omnichannel Attribution & Sales Pipeline
-- Timestamp: 20260221220000

-- 1. Order Items additions
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS unit_cost numeric NOT NULL DEFAULT 0;

-- 2. Customers additions
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS claimed_at timestamp with time zone;

-- 3. Orders additions
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS closer_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS promo_code text,
ADD COLUMN IF NOT EXISTS payment_receipt_url text,
ADD COLUMN IF NOT EXISTS bank_reference_code text,
ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS shipping_address text,
ADD COLUMN IF NOT EXISTS shipping_notes text;

-- 4. Enforce strict pipeline statuses
-- Default existing invalid statuses to 'completed' or 'pending' so we can apply the constraint
UPDATE public.orders 
SET status = 'pending_verification' 
WHERE status NOT IN (
  'draft', 
  'pending_verification', 
  'processing_fulfillment', 
  'ready_for_pickup', 
  'shipped', 
  'completed', 
  'cancelled'
);

ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN (
  'draft',
  'pending_verification',
  'processing_fulfillment',
  'ready_for_pickup',
  'shipped',
  'completed',
  'cancelled'
));

-- 5. Profiles additions
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- 6. Storage Bucket for Payment Receipts
-- Note: This requires postgres superuser, usually handled by Supabase dashboard or seed, 
-- but provided here for completeness if running as superuser.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment_receipts', 'payment_receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public reading and authenticated uploading
DROP POLICY IF EXISTS "payment_receipts_public_access" ON storage.objects;
CREATE POLICY "payment_receipts_public_access" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'payment_receipts');

DROP POLICY IF EXISTS "payment_receipts_auth_uploads" ON storage.objects;
CREATE POLICY "payment_receipts_auth_uploads" 
    ON storage.objects FOR INSERT 
    TO authenticated 
    WITH CHECK (bucket_id = 'payment_receipts');
-- Migration: Update POS RPC for Omnichannel Attribution
-- Timestamp: 20260221223000

DROP TYPE IF EXISTS pos_item_input CASCADE;
CREATE TYPE pos_item_input AS (
    product_id INTEGER,
    warehouse_id INTEGER,
    quantity NUMERIC,
    unit_price NUMERIC,
    unit_cost NUMERIC
);

CREATE OR REPLACE FUNCTION process_pos_sale(
    p_customer_id INTEGER,
    p_payment_account_id INTEGER,
    p_shipping_cost NUMERIC,
    p_items pos_item_input[],
    p_closer_id UUID DEFAULT NULL,
    p_promo_code TEXT DEFAULT NULL,
    p_shipping_address TEXT DEFAULT 'POS Walk-in'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id INTEGER;
    v_total_amount NUMERIC := 0;
    v_total_cost NUMERIC := 0;
    v_item pos_item_input;
    v_current_stock NUMERIC;
    v_revenue_account_id INTEGER;
    v_transaction_id INTEGER;
BEGIN
    -- 1. Calculate totals and verify stock
    FOREACH v_item IN ARRAY p_items
    LOOP
        -- Verify sufficient stock
        SELECT current_stock INTO v_current_stock
        FROM inventory_levels
        WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id
        FOR UPDATE; -- Lock row to prevent race conditions

        IF NOT FOUND OR v_current_stock < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto ID % en bodega %', v_item.product_id, v_item.warehouse_id;
        END IF;

        v_total_amount := v_total_amount + (v_item.quantity * v_item.unit_price);
        v_total_cost := v_total_cost + (v_item.quantity * v_item.unit_cost);
    END LOOP;

    v_total_amount := v_total_amount + p_shipping_cost;

    -- 2. Create the Order (Using pipeline strict statuses)
    INSERT INTO orders (
        customer_id, 
        closer_id, 
        promo_code, 
        status, 
        total_amount, 
        shipping_cost, 
        shipping_address
    )
    VALUES (
        p_customer_id, 
        p_closer_id, 
        p_promo_code, 
        'completed', -- Walk-in POS auto-completes
        v_total_amount, 
        p_shipping_cost,
        p_shipping_address
    )
    RETURNING id INTO v_order_id;

    -- 3. Process each item (Update Stock, Insert Order Items, Log Inventory)
    FOREACH v_item IN ARRAY p_items
    LOOP
        -- Deduct Stock
        UPDATE inventory_levels
        SET current_stock = current_stock - v_item.quantity
        WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id;

        -- Insert Order Item with unit_cost for Gross Profit calculation
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost)
        VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.unit_cost);

        -- Insert Inventory Log (Sale)
        INSERT INTO inventory_logs (
            product_id, 
            warehouse_id, 
            quantity_change, 
            reason, 
            transaction_type, 
            reference_id
        )
        VALUES (
            v_item.product_id, 
            v_item.warehouse_id, 
            -v_item.quantity, 
            'Venta POS (Orden #' || v_order_id || ')', 
            'sale', 
            v_order_id::TEXT
        );
    END LOOP;

    -- 4. Financial Transaction
    SELECT id INTO v_revenue_account_id
    FROM accounts 
    WHERE category = 'income' AND name ILIKE '%ventas%'
    LIMIT 1;

    IF FOUND THEN
        INSERT INTO transactions (description, transaction_date)
        VALUES ('Venta POS Orden #' || v_order_id, CURRENT_DATE)
        RETURNING id INTO v_transaction_id;

        -- Debit Payment Account (Increase Asset)
        INSERT INTO transaction_entries (transaction_id, account_id, amount, is_debit)
        VALUES (v_transaction_id, p_payment_account_id, v_total_amount, true);

        -- Credit Revenue Account (Increase Income)
        INSERT INTO transaction_entries (transaction_id, account_id, amount, is_debit)
        VALUES (v_transaction_id, v_revenue_account_id, v_total_amount, false);
    END IF;

    -- 5. Return Success
    RETURN jsonb_build_object(
        'success', true, 
        'order_id', v_order_id, 
        'total_amount', v_total_amount
    );
END;
$$;

-- Migration: Save POS Draft RPC
CREATE OR REPLACE FUNCTION save_draft_order(
    p_customer_id INTEGER,
    p_shipping_cost NUMERIC,
    p_items pos_item_input[],
    p_closer_id UUID DEFAULT NULL,
    p_promo_code TEXT DEFAULT NULL,
    p_draft_id INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id INTEGER;
    v_total_amount NUMERIC := 0;
    v_item pos_item_input;
BEGIN
    -- 1. Calculate totals (no stock deduction for drafts yet)
    FOREACH v_item IN ARRAY p_items
    LOOP
        v_total_amount := v_total_amount + (v_item.quantity * v_item.unit_price);
    END LOOP;

    v_total_amount := v_total_amount + p_shipping_cost;

    -- 2. Create or Update the Order Draft
    IF p_draft_id IS NOT NULL THEN
        -- Verify it's still a draft
        IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_draft_id AND status = 'draft') THEN
            RAISE EXCEPTION 'This order cannot be edited because it is no longer a draft.';
        END IF;

        UPDATE orders SET
            customer_id = p_customer_id,
            closer_id = p_closer_id,
            promo_code = p_promo_code,
            total_amount = v_total_amount,
            shipping_cost = p_shipping_cost
        WHERE id = p_draft_id
        RETURNING id INTO v_order_id;
        
        -- Delete old items to replace them
        DELETE FROM order_items WHERE order_id = v_order_id;
    ELSE
        INSERT INTO orders (
            customer_id, 
            closer_id, 
            promo_code, 
            status, 
            total_amount, 
            shipping_cost
        )
        VALUES (
            p_customer_id, 
            p_closer_id, 
            p_promo_code, 
            'draft',
            v_total_amount, 
            p_shipping_cost
        )
        RETURNING id INTO v_order_id;
    END IF;

    -- 3. Insert new Order Items
    FOREACH v_item IN ARRAY p_items
    LOOP
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost)
        VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.unit_cost);
    END LOOP;

    -- 4. Return Success
    RETURN jsonb_build_object(
        'success', true, 
        'order_id', v_order_id, 
        'total_amount', v_total_amount
    );
END;
$$;
 
 C R E A T E   T A B L E   p u b l i c . i n v e n t o r y _ g r o u p s   (  
     i d   u u i d   N O T   N U L L   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
     n a m e   t e x t   N O T   N U L L ,  
     w a r e h o u s e _ i d   i n t e g e r ,  
     c r e a t e d _ b y   u u i d ,  
     c r e a t e d _ a t   t i m e s t a m p   w i t h   t i m e   z o n e   N O T   N U L L   D E F A U L T   t i m e z o n e ( ' u t c ' : : t e x t ,   n o w ( ) ) ,  
     l a s t _ c o u n t e d _ a t   t i m e s t a m p   w i t h   t i m e   z o n e   N O T   N U L L   D E F A U L T   t i m e z o n e ( ' u t c ' : : t e x t ,   n o w ( ) ) ,  
     C O N S T R A I N T   i n v e n t o r y _ g r o u p s _ p k e y   P R I M A R Y   K E Y   ( i d ) ,  
     C O N S T R A I N T   i n v e n t o r y _ g r o u p s _ w a r e h o u s e _ i d _ f k e y   F O R E I G N   K E Y   ( w a r e h o u s e _ i d )   R E F E R E N C E S   p u b l i c . w a r e h o u s e s ( i d ) ,  
     C O N S T R A I N T   i n v e n t o r y _ g r o u p s _ c r e a t e d _ b y _ f k e y   F O R E I G N   K E Y   ( c r e a t e d _ b y )   R E F E R E N C E S   a u t h . u s e r s ( i d )  
 ) ;  
  
 C R E A T E   T A B L E   p u b l i c . i n v e n t o r y _ g r o u p _ i t e m s   (  
     i d   u u i d   N O T   N U L L   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
     g r o u p _ i d   u u i d   N O T   N U L L ,  
     p r o d u c t _ i d   i n t e g e r   N O T   N U L L ,  
     c o u n t e d _ s t o c k   i n t e g e r   D E F A U L T   0 ,  
     i s _ m a n u a l l y _ a d d e d   b o o l e a n   D E F A U L T   f a l s e ,  
     C O N S T R A I N T   i n v e n t o r y _ g r o u p _ i t e m s _ p k e y   P R I M A R Y   K E Y   ( i d ) ,  
     C O N S T R A I N T   i n v e n t o r y _ g r o u p _ i t e m s _ g r o u p _ i d _ f k e y   F O R E I G N   K E Y   ( g r o u p _ i d )   R E F E R E N C E S   p u b l i c . i n v e n t o r y _ g r o u p s ( i d )   O N   D E L E T E   C A S C A D E ,  
     C O N S T R A I N T   i n v e n t o r y _ g r o u p _ i t e m s _ p r o d u c t _ i d _ f k e y   F O R E I G N   K E Y   ( p r o d u c t _ i d )   R E F E R E N C E S   p u b l i c . p r o d u c t s ( i d )  
 ) ;  
  
 - -   R L S   p o l i c i e s   f o r   t h e   n e w   t a b l e s  
 A L T E R   T A B L E   p u b l i c . i n v e n t o r y _ g r o u p s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
 A L T E R   T A B L E   p u b l i c . i n v e n t o r y _ g r o u p _ i t e m s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 C R E A T E   P O L I C Y   " A l l o w   a u t h e n t i c a t e d   u s e r s   t o   r e a d   i n v e n t o r y   g r o u p s "   O N   p u b l i c . i n v e n t o r y _ g r o u p s   F O R   S E L E C T   T O   a u t h e n t i c a t e d   U S I N G   ( t r u e ) ;  
 C R E A T E   P O L I C Y   " A l l o w   a u t h e n t i c a t e d   u s e r s   t o   i n s e r t   i n v e n t o r y   g r o u p s "   O N   p u b l i c . i n v e n t o r y _ g r o u p s   F O R   I N S E R T   T O   a u t h e n t i c a t e d   W I T H   C H E C K   ( t r u e ) ;  
 C R E A T E   P O L I C Y   " A l l o w   a u t h e n t i c a t e d   u s e r s   t o   u p d a t e   i n v e n t o r y   g r o u p s "   O N   p u b l i c . i n v e n t o r y _ g r o u p s   F O R   U P D A T E   T O   a u t h e n t i c a t e d   U S I N G   ( t r u e ) ;  
 C R E A T E   P O L I C Y   " A l l o w   a u t h e n t i c a t e d   u s e r s   t o   d e l e t e   i n v e n t o r y   g r o u p s "   O N   p u b l i c . i n v e n t o r y _ g r o u p s   F O R   D E L E T E   T O   a u t h e n t i c a t e d   U S I N G   ( t r u e ) ;  
  
 C R E A T E   P O L I C Y   " A l l o w   a u t h e n t i c a t e d   u s e r s   t o   r e a d   i n v e n t o r y   g r o u p   i t e m s "   O N   p u b l i c . i n v e n t o r y _ g r o u p _ i t e m s   F O R   S E L E C T   T O   a u t h e n t i c a t e d   U S I N G   ( t r u e ) ;  
 C R E A T E   P O L I C Y   " A l l o w   a u t h e n t i c a t e d   u s e r s   t o   i n s e r t   i n v e n t o r y   g r o u p   i t e m s "   O N   p u b l i c . i n v e n t o r y _ g r o u p _ i t e m s   F O R   I N S E R T   T O   a u t h e n t i c a t e d   W I T H   C H E C K   ( t r u e ) ;  
 C R E A T E   P O L I C Y   " A l l o w   a u t h e n t i c a t e d   u s e r s   t o   u p d a t e   i n v e n t o r y   g r o u p   i t e m s "   O N   p u b l i c . i n v e n t o r y _ g r o u p _ i t e m s   F O R   U P D A T E   T O   a u t h e n t i c a t e d   U S I N G   ( t r u e ) ;  
 C R E A T E   P O L I C Y   " A l l o w   a u t h e n t i c a t e d   u s e r s   t o   d e l e t e   i n v e n t o r y   g r o u p   i t e m s "   O N   p u b l i c . i n v e n t o r y _ g r o u p _ i t e m s   F O R   D E L E T E   T O   a u t h e n t i c a t e d   U S I N G   ( t r u e ) ;  
 - -   A d d   u n i q u e   c o n s t r a i n t   t o   p r e v e n t   d u p l i c a t e   i t e m s   i n   t h e   s a m e   g r o u p  
 A L T E R   T A B L E   p u b l i c . i n v e n t o r y _ g r o u p _ i t e m s    
 A D D   C O N S T R A I N T   i n v e n t o r y _ g r o u p _ i t e m s _ g r o u p _ p r o d u c t _ u n i q u e   U N I Q U E   ( g r o u p _ i d ,   p r o d u c t _ i d ) ;  
  
 - -   C r e a t e   R P C   t o   s a f e l y   a n d   a t o m i c a l l y   i n c r e m e n t   t h e   c o u n t e d _ s t o c k  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p u b l i c . i n c r e m e n t _ i n v e n t o r y _ g r o u p _ i t e m (  
         p _ g r o u p _ i d   U U I D ,  
         p _ p r o d u c t _ i d   I N T ,  
         p _ a m o u n t   I N T  
 )  
 R E T U R N S   v o i d  
 L A N G U A G E   p l p g s q l  
 S E C U R I T Y   D E F I N E R  
 A S   $ $  
 B E G I N  
         I N S E R T   I N T O   p u b l i c . i n v e n t o r y _ g r o u p _ i t e m s   ( g r o u p _ i d ,   p r o d u c t _ i d ,   c o u n t e d _ s t o c k ,   i s _ m a n u a l l y _ a d d e d )  
         V A L U E S   ( p _ g r o u p _ i d ,   p _ p r o d u c t _ i d ,   p _ a m o u n t ,   t r u e )  
         O N   C O N F L I C T   ( g r o u p _ i d ,   p r o d u c t _ i d )  
         D O   U P D A T E   S E T   c o u n t e d _ s t o c k   =   p u b l i c . i n v e n t o r y _ g r o u p _ i t e m s . c o u n t e d _ s t o c k   +   p _ a m o u n t ;  
          
         - -   A l s o   u p d a t e   t h e   g r o u p ' s   l a s t _ c o u n t e d _ a t   s a f e l y  
         U P D A T E   p u b l i c . i n v e n t o r y _ g r o u p s    
         S E T   l a s t _ c o u n t e d _ a t   =   t i m e z o n e ( ' u t c ' : : t e x t ,   n o w ( ) )  
         W H E R E   i d   =   p _ g r o u p _ i d ;  
 E N D ;  
 $ $ ;  
 