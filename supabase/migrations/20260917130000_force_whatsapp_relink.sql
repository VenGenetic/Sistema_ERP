-- Permite a un administrador reiniciar una sesión de WhatsApp que todavía
-- aparece como conectada, para generar un QR nuevo desde el ERP.
--
-- El agente ya sabe atender `relink_requested_at`: al tomar el pedido borra
-- sus credenciales de Baileys y publica el QR en `agent_whatsapp_link`. Esta
-- función sólo habilita el caso excepcional de una sesión "connected" pero
-- degradada. Nunca sirve con el agente caído, porque la web no puede generar
-- un QR ni borrar credenciales por sí misma.

BEGIN;

CREATE OR REPLACE FUNCTION public.forzar_vinculacion_whatsapp()
RETURNS public.agent_whatsapp_link
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ajustes public.agent_settings%ROWTYPE;
    v_fila public.agent_whatsapp_link%ROWTYPE;
BEGIN
    IF NOT public.es_admin_del_erp() THEN
        RAISE EXCEPTION 'Sólo un administrador puede desconectar y volver a vincular WhatsApp.'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_ajustes FROM public.agent_settings WHERE id = 1;

    -- El proceso del agente es quien cierra la sesión, aparta el auth-state
    -- y pide el QR a WhatsApp. Una marca en la base sin proceso vivo sería
    -- una promesa falsa y dejaría el sistema en "preparando" para siempre.
    IF v_ajustes.agent_last_seen_at IS NULL
       OR v_ajustes.agent_last_seen_at < now() - INTERVAL '90 seconds' THEN
        RAISE EXCEPTION 'El agente no está corriendo; inícialo antes de pedir un QR nuevo.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.agent_whatsapp_link
    SET relink_requested_at = now(),
        relink_requested_by = auth.uid(),
        state = 'preparing',
        qr_png = NULL,
        qr_expires_at = NULL,
        pairing_requested_at = NULL,
        pairing_code = NULL,
        pairing_expires_at = NULL,
        detail = NULL,
        updated_at = now()
    WHERE id = 1
    RETURNING * INTO v_fila;

    RETURN v_fila;
END;
$$;

REVOKE ALL ON FUNCTION public.forzar_vinculacion_whatsapp() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forzar_vinculacion_whatsapp() TO authenticated;

COMMENT ON FUNCTION public.forzar_vinculacion_whatsapp() IS
    'Pide al agente vivo que cierre la sesión de WhatsApp y publique un QR nuevo. Sólo administradores.';

COMMIT;
