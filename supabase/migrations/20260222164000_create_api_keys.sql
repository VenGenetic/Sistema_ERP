-- Migration: Create API Keys Table
-- Timestamp: 20260222164000

-- Create the api_keys table for external integrations
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL, -- e.g., 'external_vendor', 'internal_scraper'
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Only super_admins can manage API keys (assuming a super_admin role or similar, adapting to existing RLS)
-- We will allow 'authenticated' users with specific roles if needed, but for now we restrict to service_role or admin
DROP POLICY IF EXISTS "Admin full access to api_keys" ON public.api_keys;
CREATE POLICY "Admin full access to api_keys" ON public.api_keys
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() AND r.name IN ('admin', 'super_admin')
      )
    );

-- Function to validate API key
CREATE OR REPLACE FUNCTION validate_api_key(p_key_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_valid BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.api_keys
        WHERE key_hash = p_key_hash AND is_active = true
    ) INTO v_is_valid;
    
    IF v_is_valid THEN
        UPDATE public.api_keys 
        SET last_used_at = NOW() 
        WHERE key_hash = p_key_hash;
    END IF;

    RETURN v_is_valid;
END;
$$;
