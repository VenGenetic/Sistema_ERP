-- Migration: Bitacoras — el titulo pasa a ser la fecha, y el texto libre
-- pasa a ser un resumen que sirve para identificar cada bitacora.
-- Timestamp: 20260915160000

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bitacoras' AND column_name = 'title'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bitacoras' AND column_name = 'resumen'
    ) THEN
        ALTER TABLE bitacoras RENAME COLUMN title TO resumen;
    END IF;
END $$;

ALTER TABLE bitacoras ALTER COLUMN resumen SET DEFAULT '';

-- Las filas creadas antes traian el placeholder como valor real.
UPDATE bitacoras SET resumen = '' WHERE resumen = 'Sin título';
