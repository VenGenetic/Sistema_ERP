-- Permite que una persona ubique temporalmente un chat en una bandeja.
-- La actividad nueva libera la decisión para evitar conversaciones ocultas.
BEGIN;

ALTER TABLE public.agent_conversations
    ADD COLUMN IF NOT EXISTS manual_bandeja TEXT,
    ADD COLUMN IF NOT EXISTS manual_bandeja_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS manual_bandeja_updated_by UUID;

ALTER TABLE public.agent_conversations
    DROP CONSTRAINT IF EXISTS agent_conversations_manual_bandeja_check;
ALTER TABLE public.agent_conversations
    ADD CONSTRAINT agent_conversations_manual_bandeja_check
    CHECK (manual_bandeja IS NULL OR manual_bandeja IN ('cotizar', 'responder', 'esperando', 'cerrados'));

CREATE INDEX IF NOT EXISTS idx_agent_conversations_manual_bandeja
    ON public.agent_conversations(manual_bandeja, last_message_at DESC)
    WHERE manual_bandeja IS NOT NULL;

COMMENT ON COLUMN public.agent_conversations.manual_bandeja IS
    'Ubicación temporal elegida por una persona. NULL significa clasificación automática.';

CREATE OR REPLACE FUNCTION public.liberar_bandeja_manual_con_actividad()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Un history sync inserta mensajes viejos: no debe deshacer una decisión
    -- actual del equipo. Solo la actividad reciente devuelve el chat a auto.
    IF NEW.created_at >= NOW() - INTERVAL '10 minutes' THEN
        UPDATE public.agent_conversations
        SET manual_bandeja = NULL,
            manual_bandeja_updated_at = NULL,
            manual_bandeja_updated_by = NULL
        WHERE id = NEW.conversation_id
          AND manual_bandeja IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_liberar_bandeja_manual_con_actividad ON public.agent_messages;
CREATE TRIGGER trg_liberar_bandeja_manual_con_actividad
AFTER INSERT ON public.agent_messages
FOR EACH ROW EXECUTE FUNCTION public.liberar_bandeja_manual_con_actividad();

COMMIT;
