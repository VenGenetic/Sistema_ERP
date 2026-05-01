-- Migration: Tags and Audit
-- Timestamp: 20260501164500

-- 1. Add audit columns to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- 2. Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create product_tags table
CREATE TABLE IF NOT EXISTS public.product_tags (
    product_id INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

-- Policies for tags
CREATE POLICY "Allow all access for authenticated users on tags" ON public.tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for product_tags
CREATE POLICY "Allow all access for authenticated users on product_tags" ON public.product_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
