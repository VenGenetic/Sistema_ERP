-- 1. Create inventory_backups bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('inventory_backups', 'inventory_backups', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Setup Storage Policies for inventory_backups
-- Allow inserts (uploads). Permitting anon for ease of migration if no auth is enforced right now.
CREATE POLICY "Allow Uploads to Backups" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'inventory_backups');
CREATE POLICY "Allow Updates to Backups" ON storage.objects FOR UPDATE USING (bucket_id = 'inventory_backups');
CREATE POLICY "Allow Deletes to Backups" ON storage.objects FOR DELETE USING (bucket_id = 'inventory_backups');
CREATE POLICY "Allow Select Backups (Admin Only or All for now)" ON storage.objects FOR SELECT USING (bucket_id = 'inventory_backups');
