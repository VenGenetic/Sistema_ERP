-- Limita el impacto de una subida accidental o abusiva y evita que los
-- comprobantes financieros queden expuestos mediante una URL pública.

UPDATE storage.buckets
SET
    file_size_limit = CASE id
        WHEN 'avatars' THEN 5 * 1024 * 1024
        WHEN 'payment_receipts' THEN 10 * 1024 * 1024
        WHEN 'product_references' THEN 10 * 1024 * 1024
        WHEN 'receipts' THEN 10 * 1024 * 1024
        WHEN 'product_images' THEN 10 * 1024 * 1024
        WHEN 'product_videos' THEN 50 * 1024 * 1024
        WHEN 'agent_chat_media' THEN 16 * 1024 * 1024
        ELSE file_size_limit
    END,
    allowed_mime_types = CASE id
        WHEN 'avatars' THEN ARRAY['image/*']::text[]
        WHEN 'payment_receipts' THEN ARRAY['image/*', 'application/pdf']::text[]
        WHEN 'product_references' THEN ARRAY['image/*', 'application/pdf']::text[]
        WHEN 'receipts' THEN ARRAY['image/*', 'application/pdf']::text[]
        WHEN 'product_images' THEN ARRAY['image/*']::text[]
        WHEN 'product_videos' THEN ARRAY['video/*']::text[]
        WHEN 'agent_chat_media' THEN ARRAY[
            'image/*',
            'video/*',
            'audio/*',
            'application/pdf',
            'text/plain',
            'application/octet-stream'
        ]::text[]
        ELSE allowed_mime_types
    END,
    public = CASE
        WHEN id IN ('payment_receipts', 'product_references', 'receipts') THEN false
        ELSE public
    END
WHERE id IN (
    'avatars',
    'payment_receipts',
    'product_references',
    'receipts',
    'product_images',
    'product_videos',
    'agent_chat_media'
);

-- Las migraciones antiguas dejaron algunas escrituras sin `TO authenticated`.
-- Se retiran todas las políticas que mencionan estos buckets y se reconstruye
-- una matriz pequeña y explícita. Las políticas de otros buckets no se tocan.
DO $$
DECLARE
    policy_row record;
BEGIN
    FOR policy_row IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND EXISTS (
              SELECT 1
              FROM unnest(ARRAY[
                  'avatars',
                  'payment_receipts',
                  'product_references',
                  'receipts',
                  'product_images',
                  'product_videos',
                  'agent_chat_media'
              ]) AS affected(bucket_name)
              WHERE coalesce(qual, '') LIKE '%' || quote_literal(bucket_name) || '%'
                 OR coalesce(with_check, '') LIKE '%' || quote_literal(bucket_name) || '%'
          )
    LOOP
        EXECUTE format('DROP POLICY %I ON storage.objects', policy_row.policyname);
    END LOOP;
END
$$;

CREATE POLICY "Public read catalog media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id IN ('avatars', 'product_images', 'product_videos', 'agent_chat_media'));

CREATE POLICY "Authenticated read private ERP files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id IN ('payment_receipts', 'product_references', 'receipts'));

CREATE POLICY "Authenticated upload avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Owner update avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND owner_id = (SELECT auth.uid()::text))
WITH CHECK (bucket_id = 'avatars' AND owner_id = (SELECT auth.uid()::text));

CREATE POLICY "Owner delete avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND owner_id = (SELECT auth.uid()::text));

CREATE POLICY "Authenticated upload shared ERP media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id IN (
        'payment_receipts',
        'product_references',
        'receipts',
        'product_images',
        'product_videos',
        'agent_chat_media'
    )
);

CREATE POLICY "Authenticated update shared ERP media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id IN (
        'payment_receipts',
        'product_references',
        'receipts',
        'product_images',
        'product_videos',
        'agent_chat_media'
    )
)
WITH CHECK (
    bucket_id IN (
        'payment_receipts',
        'product_references',
        'receipts',
        'product_images',
        'product_videos',
        'agent_chat_media'
    )
);

CREATE POLICY "Authenticated delete shared ERP media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id IN (
        'payment_receipts',
        'product_references',
        'receipts',
        'product_images',
        'product_videos',
        'agent_chat_media'
    )
);
