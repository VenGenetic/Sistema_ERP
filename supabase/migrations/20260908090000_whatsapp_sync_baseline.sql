-- Bootstrap honesto del espejo de WhatsApp.
--
-- 0065 dejo dos cosas rotas en produccion:
--
--  1. `whatsapp_reconcile_lid_mappings()` terminaba con un UPDATE global sin
--     WHERE sobre agent_whatsapp_lid_mappings. La proteccion de la base
--     (safeupdate) lo rechaza con SQLSTATE 21000 "UPDATE requires a WHERE
--     clause" y, como era la PRIMERA llamada de `npm run reconciliar-whatsapp`,
--     tumbaba la reconciliacion entera antes de tocar nada.
--
--  2. `possible_gap` se agrego con NOT NULL DEFAULT TRUE. Postgres rellena la
--     columna en TODAS las filas existentes, asi que los 2.839 chats
--     historicos quedaron marcados como "hueco posible" sin que hubiera
--     ninguna desconexion registrada: el backfill de una columna nueva no es
--     evidencia de un hueco real. Sin una razon explicita, un chat viejo era
--     indistinguible de un chat que si atraveso una caida.
--
-- Esta migracion es aditiva e idempotente. NO reescribe 0065: la reemplaza
-- donde hace falta con CREATE OR REPLACE.

BEGIN;

-- T0: el instante en que la instrumentacion de reliable-sync empezo a
-- observar de verdad. Antes de T0 no hay registro de desconexiones, asi que
-- no podemos afirmar ni que el pasado esta completo ni que hubo un hueco.
-- Solo la abre un proceso instrumentado al arrancar
-- (whatsapp_open_sync_baseline); la reconciliacion offline NO puede
-- inventarla.
ALTER TABLE public.agent_settings
    ADD COLUMN IF NOT EXISTS whatsapp_sync_baseline_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.agent_settings.whatsapp_sync_baseline_at IS
    'T0 de reliable-sync: primer arranque instrumentado. NULL = todavia no se observa nada.';

-- ---------------------------------------------------------------------------
-- 1. El UPDATE que rompia la reconciliacion.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.whatsapp_reconcile_lid_mappings()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    linked_phone_rows INTEGER := 0;
    promoted_lid_rows INTEGER := 0;
    duplicate_pairs INTEGER := 0;
    marked_rows INTEGER := 0;
BEGIN
    -- `deterministas` deja afuera los telefonos reclamados por mas de un LID.
    -- agent_conversations.phone_number es UNIQUE desde 0001: si dos LID
    -- apuntan al mismo numero, la promocion de abajo intentaria dejar dos
    -- filas con el mismo telefono y reventaria la reconciliacion entera con
    -- una violacion de unicidad. Y aunque no reventara, el primer UPDATE
    -- escribiria un `lid` arbitrario de los dos. Hoy no hay ninguno asi
    -- (15.811 mappings, 0 telefonos compartidos), pero un solo mapeo ambiguo
    -- alcanzaba para tumbar todo. Sin mapeo determinista se queda pendiente,
    -- que es exactamente lo que corresponde.
    WITH deterministas AS (
        SELECT m.lid, m.phone_number
        FROM public.agent_whatsapp_lid_mappings m
        WHERE NOT EXISTS (
            SELECT 1 FROM public.agent_whatsapp_lid_mappings otro
            WHERE otro.phone_number = m.phone_number AND otro.lid <> m.lid
        )
    )
    UPDATE public.agent_conversations c
    SET lid = m.lid, updated_at = NOW()
    FROM deterministas m
    WHERE c.phone_number = m.phone_number
      AND c.lid IS DISTINCT FROM m.lid;
    GET DIAGNOSTICS linked_phone_rows = ROW_COUNT;

    WITH deterministas AS (
        SELECT m.lid, m.phone_number
        FROM public.agent_whatsapp_lid_mappings m
        WHERE NOT EXISTS (
            SELECT 1 FROM public.agent_whatsapp_lid_mappings otro
            WHERE otro.phone_number = m.phone_number AND otro.lid <> m.lid
        )
    )
    UPDATE public.agent_conversations c
    SET phone_number = m.phone_number, lid = m.lid, updated_at = NOW()
    FROM deterministas m
    WHERE (c.lid = m.lid OR c.phone_number = m.lid)
      AND NOT EXISTS (
          SELECT 1 FROM public.agent_conversations phone_row
          WHERE phone_row.phone_number = m.phone_number AND phone_row.id <> c.id
      )
      AND c.phone_number IS DISTINCT FROM m.phone_number;
    GET DIAGNOSTICS promoted_lid_rows = ROW_COUNT;

    SELECT COUNT(*) INTO duplicate_pairs
    FROM public.agent_whatsapp_lid_mappings m
    JOIN public.agent_conversations phone_row ON phone_row.phone_number = m.phone_number
    JOIN public.agent_conversations lid_row
      ON lid_row.id <> phone_row.id
     AND (lid_row.lid = m.lid OR lid_row.phone_number = m.lid);

    -- Antes: `UPDATE ... SET last_reconciled_at = NOW();` sin WHERE.
    -- El alcance correcto nunca fue "todas las filas" sino "las que cambiaron
    -- desde la ultima reconciliacion". Ademas de explicito, esto hace la
    -- operacion idempotente: la segunda corrida marca 0 filas.
    UPDATE public.agent_whatsapp_lid_mappings
    SET last_reconciled_at = NOW()
    WHERE last_reconciled_at IS NULL
       OR last_reconciled_at < last_seen_at;
    GET DIAGNOSTICS marked_rows = ROW_COUNT;

    RETURN JSONB_BUILD_OBJECT(
        'phone_rows_linked', linked_phone_rows,
        'lid_rows_promoted', promoted_lid_rows,
        'duplicate_pairs', duplicate_pairs,
        'mappings_marked', marked_rows
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Apertura de la linea base. Idempotente: se abre una sola vez.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.whatsapp_open_sync_baseline()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    abiertas INTEGER := 0;
    t0 TIMESTAMP WITH TIME ZONE;
BEGIN
    UPDATE public.agent_settings
    SET whatsapp_sync_baseline_at = NOW()
    WHERE id = 1 AND whatsapp_sync_baseline_at IS NULL;
    GET DIAGNOSTICS abiertas = ROW_COUNT;

    SELECT s.whatsapp_sync_baseline_at INTO t0 FROM public.agent_settings s WHERE s.id = 1;

    IF abiertas > 0 THEN
        INSERT INTO public.agent_whatsapp_sync_events (
            event_type, process_generation, connection_generation, detail
        )
        SELECT 'sync_baseline_opened', s.whatsapp_process_generation,
               s.whatsapp_connection_generation, JSONB_BUILD_OBJECT('baseline_at', t0)
        FROM public.agent_settings s WHERE s.id = 1;
    END IF;

    RETURN t0;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. El plan de confianza. Funcion de lectura: dice que DEBERIA quedar cada
--    chat, sin escribir nada. La usan el clasificador y las auditorias.
--
--    Clases:
--      live_evidence          -> hay evidencia nueva posterior a T0 y a toda
--                                ventana de riesgo sin reconciliar. Accionable.
--      gap_window             -> el chat tiene mensajes DENTRO de una ventana
--                                de desconexion sin reconciliar. Hueco real.
--      disconnect_exposed     -> no hay mensajes conocidos dentro, pero el chat
--                                estaba activo alrededor de una ventana sin
--                                reconciliar. Falla cerrado.
--      bootstrap_legacy       -> anterior a T0 y sin ninguna ventana que lo
--                                toque. No es un hueco: es falta de historia.
--      awaiting_live_evidence -> posterior a T0 pero sin evidencia utilizable
--                                todavia (turno humano, outbox pendiente,
--                                chat de propiedad humana).
--
--    Solo `live_evidence` desbloquea. Las otras cuatro dejan la IA frenada;
--    la diferencia es que ahora se sabe POR QUE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.whatsapp_sync_confidence_plan(p_conversation_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    plan_conversation_id BIGINT,
    plan_clase TEXT,
    plan_confianza TEXT,
    plan_gap BOOLEAN,
    plan_razon TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH estado AS (
        SELECT
            (SELECT s.whatsapp_sync_baseline_at FROM public.agent_settings s WHERE s.id = 1) AS baseline,
            EXISTS (
                SELECT 1 FROM public.agent_whatsapp_disconnects w WHERE w.reconnected_at IS NULL
            ) AS ventana_abierta
    ),
    calculadas AS (
        SELECT
            c.id AS cid,
            CASE
                -- C. Evidencia viva posterior a T0 y a toda ventana de riesgo.
                WHEN e.baseline IS NOT NULL
                 AND NOT e.ventana_abierta
                 AND c.last_inbound_at IS NOT NULL
                 AND c.last_inbound_at > e.baseline
                 AND NOT EXISTS (
                     SELECT 1 FROM public.agent_whatsapp_disconnects w
                     WHERE w.reconciliation_state IS DISTINCT FROM 'synced'
                       AND (w.reconnected_at IS NULL OR w.reconnected_at >= c.last_inbound_at)
                 )
                 -- Un fromMe humano posterior al cliente manda el turno; no se
                 -- libera nada encima de un vendedor.
                 AND (c.last_human_outbound_at IS NULL OR c.last_human_outbound_at <= c.last_inbound_at)
                 AND COALESCE(c.status, '') NOT IN ('human_active', 'closed', 'escalated')
                 AND COALESCE(c.etapa, '') NOT IN ('ready_for_sales', 'human_assigned', 'resolved')
                 AND NOT EXISTS (
                     SELECT 1 FROM public.agent_outbox o
                     WHERE o.conversation_id = c.id AND o.status = 'pending'
                 )
                THEN 'live_evidence'
                -- A. Hueco real: actividad conocida dentro de la ventana.
                WHEN EXISTS (
                    SELECT 1 FROM public.agent_whatsapp_disconnects w
                    WHERE w.reconciliation_state IS DISTINCT FROM 'synced'
                      AND EXISTS (
                          SELECT 1 FROM public.agent_messages m
                          WHERE m.conversation_id = c.id
                            AND m.created_at >= w.disconnected_at
                            AND m.created_at <= COALESCE(w.reconnected_at, NOW())
                      )
                ) THEN 'gap_window'
                -- A-debil: chat vivo alrededor de una ventana sin reconciliar.
                -- Un chat dormido hace mas de 30 dias no se considera expuesto:
                -- no tuvo actividad ni antes ni durante.
                WHEN EXISTS (
                    SELECT 1 FROM public.agent_whatsapp_disconnects w
                    WHERE w.reconciliation_state IS DISTINCT FROM 'synced'
                      AND c.first_message_at IS NOT NULL
                      AND c.first_message_at <= COALESCE(w.reconnected_at, NOW())
                      AND c.last_message_at IS NOT NULL
                      AND c.last_message_at >= w.disconnected_at - INTERVAL '30 days'
                ) THEN 'disconnect_exposed'
                -- B. Legacy: sin T0 abierto, o sin actividad posterior a T0.
                WHEN e.baseline IS NULL
                  OR c.last_message_at IS NULL
                  OR c.last_message_at <= e.baseline
                THEN 'bootstrap_legacy'
                -- D. Incierto real.
                ELSE 'awaiting_live_evidence'
            END AS clase_calculada
        FROM public.agent_conversations c
        CROSS JOIN estado e
        WHERE (p_conversation_id IS NULL OR c.id = p_conversation_id)
          AND (c.possible_gap OR c.sync_confidence = 'uncertain')
    )
    SELECT
        k.cid,
        k.clase_calculada,
        CASE WHEN k.clase_calculada = 'live_evidence' THEN 'live_evidence' ELSE 'uncertain' END,
        k.clase_calculada IN ('gap_window', 'disconnect_exposed'),
        CASE WHEN k.clase_calculada = 'live_evidence' THEN NULL ELSE k.clase_calculada END
    FROM calculadas k;
$$;

-- ---------------------------------------------------------------------------
-- 4. Aplica el plan. Con WHERE explicito y solo sobre las filas que cambian,
--    asi la segunda corrida devuelve changed = 0.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.whatsapp_classify_sync_confidence(p_conversation_id BIGINT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cambiados INTEGER := 0;
    resumen JSONB;
BEGIN
    UPDATE public.agent_conversations c
    SET sync_confidence = p.plan_confianza,
        possible_gap = p.plan_gap,
        sync_uncertain_reason = p.plan_razon,
        last_reconciled_at = CASE
            WHEN p.plan_clase = 'live_evidence' THEN NOW()
            ELSE c.last_reconciled_at
        END,
        updated_at = NOW()
    FROM public.whatsapp_sync_confidence_plan(p_conversation_id) p
    WHERE c.id = p.plan_conversation_id
      AND (c.sync_confidence IS DISTINCT FROM p.plan_confianza
           OR c.possible_gap IS DISTINCT FROM p.plan_gap
           OR c.sync_uncertain_reason IS DISTINCT FROM p.plan_razon);
    GET DIAGNOSTICS cambiados = ROW_COUNT;

    SELECT COALESCE(JSONB_OBJECT_AGG(t.plan_clase, t.n), '{}'::JSONB) INTO resumen
    FROM (
        SELECT plan_clase, COUNT(*) AS n
        FROM public.whatsapp_sync_confidence_plan(p_conversation_id)
        GROUP BY plan_clase
    ) t;

    IF cambiados > 0 THEN
        INSERT INTO public.agent_whatsapp_sync_events (
            event_type, process_generation, connection_generation, conversation_id, detail
        )
        SELECT 'sync_confidence_classified', s.whatsapp_process_generation,
               s.whatsapp_connection_generation, p_conversation_id,
               JSONB_BUILD_OBJECT('changed', cambiados, 'classes', resumen)
        FROM public.agent_settings s WHERE s.id = 1;
    END IF;

    RETURN JSONB_BUILD_OBJECT('changed', cambiados, 'classes', resumen);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Marcado de hueco al reconectar, acotado y auditable.
--    Reemplaza al UPDATE masivo que el proceso hacia por PostgREST sobre
--    TODOS los chats con bot_enabled, sin importar si estaban dormidos hace
--    meses ni a que ventana pertenecia el riesgo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.whatsapp_mark_gap_after_reconnect(p_disconnect_id BIGINT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inicio TIMESTAMP WITH TIME ZONE;
    cambiados INTEGER := 0;
BEGIN
    SELECT w.disconnected_at INTO inicio
    FROM public.agent_whatsapp_disconnects w WHERE w.id = p_disconnect_id;
    inicio := COALESCE(inicio, NOW());

    UPDATE public.agent_conversations c
    SET possible_gap = TRUE,
        sync_confidence = 'uncertain',
        sync_uncertain_reason = 'disconnect_or_process_restart',
        updated_at = NOW()
    WHERE c.bot_enabled
      AND (c.last_message_at IS NULL OR c.last_message_at >= inicio - INTERVAL '30 days')
      AND (NOT c.possible_gap
           OR c.sync_confidence IS DISTINCT FROM 'uncertain'
           OR c.sync_uncertain_reason IS DISTINCT FROM 'disconnect_or_process_restart');
    GET DIAGNOSTICS cambiados = ROW_COUNT;
    RETURN cambiados;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Desglose real de los LID pendientes. La metrica anterior se calculaba en
--    JavaScript sobre una pagina de 1000 filas que PostgREST truncaba en
--    silencio, asi que informaba 701 donde habia 1373.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.whatsapp_pending_lid_summary()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH pendientes AS (
        SELECT c.id AS cid,
               COALESCE(NULLIF(c.lid, ''), c.phone_number) AS lid_key,
               c.last_message_at AS ultimo,
               c.bot_enabled AS activo
        FROM public.agent_conversations c
        WHERE c.chat_jid LIKE '%@lid'
          AND (c.lid IS NULL OR c.lid = '' OR c.lid = c.phone_number)
    ),
    resueltas AS (
        SELECT p.cid, p.lid_key, p.ultimo, p.activo, m.phone_number AS pn
        FROM pendientes p
        LEFT JOIN public.agent_whatsapp_lid_mappings m ON m.lid = p.lid_key
    ),
    marcadas AS (
        SELECT r.cid, r.ultimo, r.activo, r.pn,
               (r.pn IS NOT NULL AND EXISTS (
                   SELECT 1 FROM public.agent_conversations o
                   WHERE o.phone_number = r.pn AND o.id <> r.cid
               )) AS duplicada
        FROM resueltas r
    )
    SELECT JSONB_BUILD_OBJECT(
        'pendientes_total', COUNT(*),
        'sin_pn_conocido', COUNT(*) FILTER (WHERE pn IS NULL),
        'mapping_disponible', COUNT(*) FILTER (WHERE pn IS NOT NULL),
        'duplicado_lid_pn', COUNT(*) FILTER (WHERE duplicada),
        'promovible_en_sitio', COUNT(*) FILTER (WHERE pn IS NOT NULL AND NOT duplicada),
        'historico_inactivo', COUNT(*) FILTER (
            WHERE NOT activo AND (ultimo IS NULL OR ultimo < NOW() - INTERVAL '90 days')
        )
    )
    FROM marcadas;
$$;

GRANT EXECUTE ON FUNCTION public.whatsapp_open_sync_baseline() TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_sync_confidence_plan(BIGINT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_classify_sync_confidence(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_mark_gap_after_reconnect(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_pending_lid_summary() TO service_role, authenticated;

COMMIT;
