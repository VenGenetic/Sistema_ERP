-- 1. Add image_url to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create product_images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Setup Storage Policies for product_images
-- Allow public access to read images
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'product_images');

-- Allow inserts (uploads). Permitting anon for ease of migration if no auth is enforced right now.
CREATE POLICY "Allow Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product_images');
CREATE POLICY "Allow Updates" ON storage.objects FOR UPDATE USING (bucket_id = 'product_images');
CREATE POLICY "Allow Deletes" ON storage.objects FOR DELETE USING (bucket_id = 'product_images');
