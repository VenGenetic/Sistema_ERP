-- Migration: Create Bitacoras (logbook) module
-- Timestamp: 20260915150000

CREATE TABLE IF NOT EXISTS bitacoras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL DEFAULT 'Sin título',
    content TEXT NOT NULL DEFAULT '',
    bitacora_date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'America/Guayaquil'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_bitacoras_bitacora_date ON bitacoras (bitacora_date DESC);
CREATE INDEX IF NOT EXISTS idx_bitacoras_created_at ON bitacoras (created_at DESC);

-- Keep updated_at current on every edit
CREATE OR REPLACE FUNCTION set_bitacoras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bitacoras_updated_at ON bitacoras;
CREATE TRIGGER trg_bitacoras_updated_at
    BEFORE UPDATE ON bitacoras
    FOR EACH ROW
    EXECUTE FUNCTION set_bitacoras_updated_at();

-- Enable RLS on bitacoras
ALTER TABLE bitacoras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to bitacoras for authenticated" ON bitacoras;
DROP POLICY IF EXISTS "Allow insert access to bitacoras for authenticated" ON bitacoras;
DROP POLICY IF EXISTS "Allow update access to bitacoras for authenticated" ON bitacoras;
DROP POLICY IF EXISTS "Allow delete access to bitacoras for authenticated" ON bitacoras;

CREATE POLICY "Allow read access to bitacoras for authenticated"
    ON bitacoras FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert access to bitacoras for authenticated"
    ON bitacoras FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update access to bitacoras for authenticated"
    ON bitacoras FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete access to bitacoras for authenticated"
    ON bitacoras FOR DELETE
    USING (auth.role() = 'authenticated');
