-- Migration: Añadir soporte para videos de productos
-- Timestamp: 20260429010000

-- 1. Añadir la columna de URL de video a la tabla de productos
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 2. Crear el Bucket de Storage para videos (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product_videos', 'product_videos', true, 52428800, '{"video/*"}') -- 50MB Limit aprox
ON CONFLICT (id) DO NOTHING;

-- 3. Crear Políticas de Seguridad (RLS) para el nuevo bucket
DO $$
BEGIN
    -- Permitir acceso de lectura público a los videos
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access to product_videos' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Allow public read access to product_videos" ON storage.objects FOR SELECT USING (bucket_id = 'product_videos');
    END IF;

    -- Permitir a usuarios autenticados subir videos
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated upload to product_videos' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Allow authenticated upload to product_videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product_videos');
    END IF;

    -- Permitir a usuarios autenticados actualizar videos
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated update to product_videos' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Allow authenticated update to product_videos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product_videos');
    END IF;

    -- Permitir a usuarios autenticados eliminar videos
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated delete to product_videos' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Allow authenticated delete to product_videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product_videos');
    END IF;
END $$;
