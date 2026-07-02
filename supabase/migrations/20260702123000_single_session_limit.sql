-- Migration: Single Session Limit per User
-- Timestamp: 20260702123000

-- 1. Agregar columna para rastrear la sesión activa en profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_session_id TEXT;

-- 2. Habilitar Realtime para la tabla profiles
BEGIN;
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'profiles'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
      END IF;
    END IF;
  END
  $$;
COMMIT;

-- 3. Crear función para limpiar sesiones anteriores en auth.sessions
CREATE OR REPLACE FUNCTION public.handle_single_session()
RETURNS trigger AS $$
BEGIN
  -- Elimina las demás sesiones activas del mismo usuario
  DELETE FROM auth.sessions
  WHERE user_id = NEW.user_id AND id <> NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 4. Crear el disparador en la tabla auth.sessions
DROP TRIGGER IF EXISTS limit_single_session ON auth.sessions;
CREATE TRIGGER limit_single_session
  AFTER INSERT ON auth.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_single_session();
