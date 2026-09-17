-- Confirmación excepcional y auditable de la sincronización de UN chat.
--
-- La reconciliación automática sigue siendo la vía normal. Esta función sólo
-- permite que un administrador quite manualmente la barrera de "Sync
-- incierta" después de revisar el historial del cliente. No enciende el bot,
-- no cambia el estado humano del chat y no autoriza grupos.

BEGIN;

DO $$
BEGIN
    IF to_regprocedure('public.es_admin_del_erp()') IS NULL THEN
        RAISE EXCEPTION
            'Falta public.es_admin_del_erp(). Aplicá antes la migración 0079 del repo del agente.';
    END IF;

    IF to_regclass('public.agent_whatsapp_sync_events') IS NULL THEN
        RAISE EXCEPTION
            'Falta public.agent_whatsapp_sync_events. Aplicá antes la migración de sincronización confiable de WhatsApp.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmar_sincronizacion_manual(
    p_conversation_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_conversacion public.agent_conversations%ROWTYPE;
    v_ajustes public.agent_settings%ROWTYPE;
    v_cambios INTEGER := 0;
BEGIN
    IF NOT public.es_admin_del_erp() THEN
        RAISE EXCEPTION 'Sólo un administrador puede confirmar que un chat está sincronizado.'
            USING ERRCODE = '42501';
    END IF;

    IF p_conversation_id IS NULL THEN
        RAISE EXCEPTION 'Falta la conversación a confirmar.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_conversacion
    FROM public.agent_conversations
    WHERE id = p_conversation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La conversación % no existe.', p_conversation_id USING ERRCODE = 'P0002';
    END IF;

    -- `is_group` se agregó desde el agente y puede no existir en instalaciones
    -- antiguas. Convertir la fila a JSON evita que esta función deje de
    -- instalarse allí; donde la columna exista, sigue rechazando grupos.
    IF COALESCE((to_jsonb(v_conversacion) ->> 'is_group')::BOOLEAN, FALSE) THEN
        RAISE EXCEPTION 'El agente no atiende grupos; sólo se puede confirmar un chat de cliente.'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.agent_conversations
    SET sync_confidence = 'synced',
        possible_gap = FALSE,
        sync_uncertain_reason = NULL,
        last_reconciled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_conversation_id
      AND (
          sync_confidence IS DISTINCT FROM 'synced'
          OR possible_gap
          OR sync_uncertain_reason IS NOT NULL
      );

    GET DIAGNOSTICS v_cambios = ROW_COUNT;

    -- El evento guarda quién lo confirmó y el estado que se dejó atrás. No
    -- duplicamos eventos si alguien repite una confirmación ya aplicada.
    IF v_cambios > 0 THEN
        SELECT * INTO v_ajustes FROM public.agent_settings WHERE id = 1;

        INSERT INTO public.agent_whatsapp_sync_events (
            event_type,
            process_generation,
            connection_generation,
            conversation_id,
            reason,
            detail
        ) VALUES (
            'sync_confirmed_manually',
            v_ajustes.whatsapp_process_generation,
            v_ajustes.whatsapp_connection_generation,
            p_conversation_id,
            'confirmed_by_admin',
            jsonb_build_object(
                'confirmed_by', auth.uid(),
                'previous_confidence', v_conversacion.sync_confidence,
                'previous_possible_gap', v_conversacion.possible_gap,
                'previous_reason', v_conversacion.sync_uncertain_reason
            )
        );
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_sincronizacion_manual(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_sincronizacion_manual(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.confirmar_sincronizacion_manual(BIGINT) IS
    'Administrador confirma manualmente que el historial de un cliente está completo; libera sólo la barrera de sincronización para la IA.';

COMMIT;
