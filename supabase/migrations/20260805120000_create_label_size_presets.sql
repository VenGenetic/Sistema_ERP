-- 20260805120000_create_label_size_presets.sql
-- Stores custom sticky-label size presets (width/height in mm) that users can
-- select when printing barcode labels on the thermal printer, in addition to
-- the built-in standard sizes defined in the frontend (utils/labelPresets.ts).
-- Shared shop-wide (not per-user) since these describe physical label stock
-- everyone printing on the same thermal printer needs to pick from.

CREATE TABLE IF NOT EXISTS public.label_size_presets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    width_mm numeric NOT NULL CHECK (width_mm > 0),
    height_mm numeric NOT NULL CHECK (height_mm > 0),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.label_size_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view label presets" ON public.label_size_presets;
CREATE POLICY "Authenticated users can view label presets"
ON public.label_size_presets FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert label presets" ON public.label_size_presets;
CREATE POLICY "Authenticated users can insert label presets"
ON public.label_size_presets FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete label presets" ON public.label_size_presets;
CREATE POLICY "Authenticated users can delete label presets"
ON public.label_size_presets FOR DELETE
TO authenticated
USING (true);
