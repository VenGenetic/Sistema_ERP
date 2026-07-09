-- Add gallery JSONB column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::jsonb;

-- Migrate existing video_url data into the gallery array
UPDATE public.products
SET gallery = jsonb_build_array(
    jsonb_build_object(
        'url', video_url,
        'type', 'video'
    )
)
WHERE video_url IS NOT NULL AND video_url != '';

-- Drop the legacy video_url column
ALTER TABLE public.products DROP COLUMN IF EXISTS video_url;
