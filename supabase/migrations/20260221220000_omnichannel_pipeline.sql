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
