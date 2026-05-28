-- Migration: Create Customer Requests (WhatsApp Waitlist)
-- Timestamp: 20260528144300

CREATE TABLE IF NOT EXISTS public.customer_requests (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES public.products(id) ON DELETE SET NULL,
    custom_part_description TEXT,
    motorcycle_details TEXT,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'notified', 'completed', 'cancelled')),
    is_urgent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.customer_requests ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS "Allow all operations for authenticated users on customer_requests" ON public.customer_requests;

-- Add policy for authenticated users to perform all operations
CREATE POLICY "Allow all operations for authenticated users on customer_requests" ON public.customer_requests
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
